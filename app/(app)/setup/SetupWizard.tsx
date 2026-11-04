'use client'

import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Bucket } from '@/components/Bucket'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Field, MoneyInput, TextInput } from '@/components/Field'
import { BottomActions, Card, Message, Screen } from '@/components/Screen'
import { computeBudget } from '@/lib/budget'
import { cycleFor, shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { FIXED_MAX_COUNT, FIXED_NAME_MAX, type SaveMonthInput } from '@/lib/validation'
import { saveMonth } from './actions'

type Props = {
  defaults: SaveMonthInput
  today: string
  /** 처음 쓰는 경우에만 날짜 단계부터 시작한다 */
  isFirst: boolean
}

type FixedRow = { key: number; name: string; amount: number }
type Step = 1 | 2 | 3

const TOTAL_STEPS = 3
const LIVING_STEP = 10_000
const STEP_TITLES: Record<Step, string> = { 1: '날짜 설정', 2: '수입과 지출', 3: '예산 나누기' }

const ERRORS: Record<string, string> = {
  INVALID: '입력한 값을 다시 확인해 주세요.',
  DB: '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.',
}

export function SetupWizard({ defaults, today, isFirst }: Props) {
  const router = useRouter()
  const firstStep: Step = isFirst ? 1 : 2
  const [step, setStep] = useState<Step>(firstStep)
  const [payDay, setPayDay] = useState(defaults.payDay)
  const [cardCutoffDay, setCardCutoffDay] = useState(defaults.cardCutoffDay)
  const [salary, setSalary] = useState(defaults.salary)
  const [cardBalance, setCardBalance] = useState(defaults.cardBalance)
  const [livingTarget, setLivingTarget] = useState(defaults.livingTarget)
  const [emergencyAmount, setEmergencyAmount] = useState(defaults.emergencyAmount)
  const [fixed, setFixed] = useState<FixedRow[]>(() => defaults.fixed.map((f, i) => ({ key: i, ...f })))
  const [nextKey, setNextKey] = useState(defaults.fixed.length)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // 월급일을 바꾸면 주기도 바뀐다. 날짜 계산은 lib/cycle 에만 둔다.
  const cycle = useMemo(() => cycleFor(today, payDay), [today, payDay])
  const fixedTotal = fixed.reduce((sum, f) => sum + f.amount, 0)
  const budget = computeBudget({ salary, fixedTotal, cardBalance, livingTarget, emergencyAmount, cycleDays: cycle.days })
  // 이름 없는 0원 줄은 빈 줄로 보고 버린다. 금액만 있고 이름이 없으면 진행을 막는다.
  const filledFixed = fixed.filter((f) => f.name.trim() !== '' || f.amount > 0)
  const fixedValid = filledFixed.every((f) => f.name.trim() !== '')
  const livingMax = Math.max(budget.available, 0)
  const livingPct = livingMax === 0 ? 0 : (Math.min(livingTarget, livingMax) / livingMax) * 100

  const updateFixed = (key: number, patch: Partial<FixedRow>) =>
    setFixed((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addFixed = () => {
    setFixed((rows) => [...rows, { key: nextKey, name: '', amount: 0 }])
    setNextKey((k) => k + 1)
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveMonth({
        payDay,
        cardCutoffDay,
        salary,
        cardBalance,
        livingTarget,
        emergencyAmount,
        fixed: filledFixed.map(({ name, amount }) => ({ name: name.trim(), amount })),
      })
      if (!result.ok) {
        if (result.error === 'UNAUTHORIZED') return router.replace('/login')
        setError(ERRORS[result.error] ?? ERRORS.DB)
      }
      // 성공하면 액션이 서버에서 홈으로 redirect 해 여기로 돌아오지 않는다
    })
  }

  const message = error ?? (step === 2 && !fixedValid ? '고정지출 이름을 입력해 주세요.' : null)

  return (
    <Screen
      title={STEP_TITLES[step]}
      sub={`${shortDate(cycle.start)}~${shortDate(cycle.end)}`}
      action={
        <Chip>
          {step} / {TOTAL_STEPS}
        </Chip>
      }
    >
      {step === 1 && (
        <>
          <DayField label="월급일" value={payDay} onChange={setPayDay} />
          <DayField label="카드값 확정일" value={cardCutoffDay} onChange={setCardCutoffDay} />
        </>
      )}

      {step === 2 && (
        <>
          <Card>
            <Field label="월급">
              <MoneyInput label="월급" value={salary} onChange={setSalary} />
            </Field>
          </Card>

          <Card aria-label="고정지출">
            <Field label="고정지출" aside={<span className="font-bold text-ink">{formatWon(fixedTotal)}원</span>}>
              <ul className="flex flex-col gap-2">
                {fixed.map((f) => (
                  <li key={f.key} className="grid grid-cols-[minmax(0,1fr)_8rem_2rem] items-center gap-2">
                    <TextInput
                      aria-label="항목 이름"
                      placeholder="항목 이름"
                      maxLength={FIXED_NAME_MAX}
                      value={f.name}
                      invalid={f.amount > 0 && f.name.trim() === ''}
                      onChange={(e) => updateFixed(f.key, { name: e.target.value })}
                    />
                    <MoneyInput label={`${f.name || '항목'} 금액`} value={f.amount} onChange={(amount) => updateFixed(f.key, { amount })} />
                    <button
                      type="button"
                      aria-label={`${f.name || '항목'} 삭제`}
                      className="flex size-8 items-center justify-center rounded-full text-lg text-muted active:bg-soft"
                      onClick={() => setFixed((rows) => rows.filter((r) => r.key !== f.key))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {fixed.length < FIXED_MAX_COUNT && (
                <button
                  type="button"
                  onClick={addFixed}
                  className="h-12 w-full rounded-xl border border-dashed border-line text-sm text-deep active:bg-tint"
                >
                  + 항목 추가
                </button>
              )}
            </Field>
          </Card>

          <Card>
            <Field label="현재 카드값">
              <MoneyInput label="현재 카드값" value={cardBalance} onChange={setCardBalance} />
            </Field>
          </Card>

          <Card tone="tint">
            <p className="text-sm text-muted">다음 달 쓸 수 있는 돈</p>
            <p className={clsx('mt-2 text-3xl font-bold', budget.available < 0 ? 'text-red' : 'text-deep')}>
              {formatWon(budget.available)}
              <span className="ml-0.5 text-base">원</span>
            </p>
          </Card>
        </>
      )}

      {step === 3 && (
        <>
          <Card tone="tint">
            <p className="text-sm text-muted">쓸 수 있는 돈</p>
            <p className={clsx('mt-2 text-3xl font-bold', budget.available < 0 ? 'text-red' : 'text-deep')}>
              {formatWon(budget.available)}
              <span className="ml-0.5 text-base">원</span>
            </p>
          </Card>

          <Bucket name="생활비" amount={formatWon(livingTarget)} sub={`하루 ${formatWon(budget.livingPerDay)}원`}>
            <input
              type="range"
              aria-label="생활비"
              min={0}
              max={livingMax}
              step={LIVING_STEP}
              value={Math.min(livingTarget, livingMax)}
              disabled={livingMax === 0}
              onChange={(e) => setLivingTarget(Number(e.target.value))}
              // 채워진 쪽만 핑크로. 브라우저 기본 트랙 색(회색·검정)을 덮는다
              style={{ background: `linear-gradient(to right, var(--color-pink) ${livingPct}%, var(--color-soft) ${livingPct}%)` }}
              className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-40 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-pink [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-pink [&::-webkit-slider-thumb]:bg-white"
            />
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>0</span>
              <span>{formatWon(livingMax)}</span>
            </div>
          </Bucket>

          <Bucket tone="green" name="비상금" amount={<MoneyInput label="비상금" value={emergencyAmount} onChange={setEmergencyAmount} className="w-36" />} />

          <Bucket
            highlight
            name={
              <>
                쇼핑 예산 <span className="ml-1 text-xs font-normal text-muted">자동 계산</span>
              </>
            }
            amount={formatWon(budget.shopping)}
            amountTone={budget.shoppingExhausted ? 'red' : 'deep'}
          />
        </>
      )}

      <BottomActions>
        <Message>
          {step === 3 && !message && budget.shoppingExhausted ? (
            <>
              이번 달은 쇼핑 예산이 없어요.
              <br />
              생활비가 {formatWon(-budget.shoppingRaw)}원 부족해요.
            </>
          ) : (
            message && <span className="whitespace-pre-line">{message}</span>
          )}
        </Message>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={step === 2 && !fixedValid}>
            다음
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            {pending ? '저장 중…' : '저장'}
          </Button>
        )}
        {step > 1 && (
          <Button variant="text" onClick={() => setStep((s) => (s - 1) as Step)} disabled={pending}>
            이전
          </Button>
        )}
      </BottomActions>
    </Screen>
  )
}

function DayField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Card>
      <label className="flex items-center justify-between gap-3">
        <span className="font-bold">{label}</span>
        <span className="flex items-center gap-1">
          <select
            aria-label={label}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-12 rounded-xl border border-line bg-white px-3 text-base font-bold text-deep outline-none focus:border-pink"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">일</span>
        </span>
      </label>
    </Card>
  )
}
