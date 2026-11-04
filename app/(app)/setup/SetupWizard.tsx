'use client'

import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Bucket } from '@/components/Bucket'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { computeBudget } from '@/lib/budget'
import { cycleFor } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { FIXED_MAX_COUNT, FIXED_NAME_MAX, type SaveMonthInput } from '@/lib/validation'
import { saveMonth } from './actions'
import { MoneyInput } from './MoneyInput'

type Props = {
  defaults: SaveMonthInput
  today: string
  /** 처음 쓰는 경우에만 월급일·확정일 단계부터 시작한다 */
  isFirst: boolean
}

type FixedRow = { key: number; name: string; amount: number }
type Step = 1 | 2 | 3

const TOTAL_STEPS = 3
const LIVING_STEP = 10_000

const ERRORS: Record<string, string> = {
  INVALID: '입력값을 다시 확인해 주세요',
  DB: '저장하지 못했어요. 잠시 후 다시 시도해 주세요',
}

const md = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
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
  const monthLabel = `${Number(cycle.ym.slice(5))}월`
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
        return
      }
      // Activity 로 숨겨진 채 남으므로 다음에 열 때 첫 단계부터 보이게 되돌린다
      setStep(firstStep)
      router.push('/')
    })
  }

  return (
    <div className="flex min-h-[calc(100dvh-12px)] flex-col px-5 pt-5 pb-8 md:min-h-[832px]">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <span className="text-pink">♡</span> {step === 3 ? '통 나누기' : `${monthLabel} 설정`}
          <span className="ml-2 text-sm font-normal text-muted">
            {md(cycle.start)}~{md(cycle.end)}
          </span>
        </h1>
        <Chip>
          {step} / {TOTAL_STEPS}
        </Chip>
      </header>

      <div className="flex flex-1 flex-col gap-3">
        {step === 1 && (
          <>
            <p className="mb-1 text-sm text-muted">한 번만 정하면 돼요. 나중에 설정에서 바꿀 수 있어요.</p>
            <DayField label="월급일" desc="이 날부터 다음 월급일 전날까지가 한 주기예요" value={payDay} onChange={setPayDay} />
            <DayField
              label="카드 확정일"
              desc="다음 월급에서 빠져나갈 카드값이 정해지는 날 (예산은 리셋되지 않아요)"
              value={cardCutoffDay}
              onChange={setCardCutoffDay}
            />
          </>
        )}

        {step === 2 && (
          <>
            <label className="block rounded-card border border-line bg-white px-4 py-3">
              <span className="text-xs text-muted">이번 달 월급</span>
              <MoneyInput label="이번 달 월급" value={salary} onChange={setSalary} className="mt-1 flex text-lg [&_input]:text-left" />
            </label>

            <section className="rounded-card border border-line bg-white px-4 py-3" aria-label="고정지출">
              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>고정지출</span>
                <span className="font-bold text-ink">{formatWon(fixedTotal)}</span>
              </div>
              <ul className="flex flex-col">
                {fixed.map((f) => (
                  <li key={f.key} className="flex items-center gap-2 py-1.5">
                    <input
                      aria-label="고정지출 이름"
                      placeholder="항목 이름"
                      maxLength={FIXED_NAME_MAX}
                      className={clsx(
                        'min-w-0 flex-1 bg-transparent outline-none placeholder:text-line',
                        f.amount > 0 && f.name.trim() === '' && 'placeholder:text-red',
                      )}
                      value={f.name}
                      onChange={(e) => updateFixed(f.key, { name: e.target.value })}
                    />
                    <MoneyInput label={`${f.name || '항목'} 금액`} value={f.amount} onChange={(amount) => updateFixed(f.key, { amount })} suffix={false} className="w-28" />
                    <button
                      type="button"
                      aria-label={`${f.name || '항목'} 삭제`}
                      className="size-7 shrink-0 rounded-full text-muted active:bg-soft"
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
                  className="mt-2 h-10 w-full rounded-xl border border-dashed border-line text-sm text-deep active:bg-tint"
                >
                  + 항목 추가
                </button>
              )}
            </section>

            <label className="block rounded-card border border-line bg-white px-4 py-3">
              <span className="flex justify-between text-xs text-muted">
                <span>현재 카드값</span>
                <span>카드사 앱에서 확인</span>
              </span>
              <MoneyInput label="현재 카드값" value={cardBalance} onChange={setCardBalance} className="mt-1 flex text-lg [&_input]:text-left" />
            </label>

            <div className="rounded-card bg-tint px-4 py-3">
              <p className="text-xs text-muted">다음 달 쓸 수 있는 돈</p>
              <p className={clsx('text-2xl font-bold', budget.available < 0 ? 'text-red' : 'text-deep')}>
                {formatWon(budget.available)}
                <span className="text-sm">원</span>
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-card bg-tint px-4 py-3">
              <p className="text-xs text-muted">나눌 돈</p>
              <p className={clsx('text-2xl font-bold', budget.available < 0 ? 'text-red' : 'text-deep')}>
                {formatWon(budget.available)}
                <span className="text-sm">원</span>
              </p>
            </div>

            <Bucket
              name="생활비 지킬 선"
              desc={`식비·교통·잡비. 하루 ${formatWon(budget.livingPerDay)}원`}
              amount={formatWon(livingTarget)}
            />
            <div className="rounded-card border border-line bg-white px-4 py-3">
              <input
                type="range"
                aria-label="생활비 지킬 선"
                min={0}
                max={livingMax}
                step={LIVING_STEP}
                value={Math.min(livingTarget, livingMax)}
                disabled={livingMax === 0}
                onChange={(e) => setLivingTarget(Number(e.target.value))}
                // 채워진 쪽만 핑크로. 브라우저 기본 트랙 색(회색·검정)을 덮는다
                style={{ background: `linear-gradient(to right, var(--color-pink) ${livingPct}%, var(--color-soft) ${livingPct}%)` }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-40 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-pink [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-pink [&::-webkit-slider-thumb]:bg-white"
              />
              <div className="flex justify-between text-xs text-muted">
                <span>0</span>
                <span>{formatWon(livingMax)}</span>
              </div>
            </div>

            <Bucket
              tone="green"
              name="비상금 떼어두기"
              desc="경조사·급한 일. 매달 같은 돈"
              amount={
                <MoneyInput
                  label="비상금"
                  value={emergencyAmount}
                  onChange={setEmergencyAmount}
                  suffix={false}
                  className="w-24 rounded-lg bg-tint px-2 py-1"
                />
              }
            />

            <Bucket
              highlight
              name={
                <>
                  쇼핑 예산 <span className="text-xs font-normal text-muted">자동</span>
                </>
              }
              desc="남은 돈 − 생활비 − 비상금"
              amount={formatWon(budget.shopping)}
              amountTone={budget.shoppingExhausted ? 'red' : 'deep'}
            />
            {budget.shoppingExhausted ? (
              <p className="text-center text-sm text-red" role="status">
                이번 달은 쇼핑 없음 · 생활비가 {formatWon(-budget.shoppingRaw)}원 모자라요
              </p>
            ) : (
              <p className="text-center text-xs text-muted">생활비와 비상금을 정하면 쇼핑 예산은 남는 만큼이 돼요</p>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span key={i} className={clsx('h-1 w-5 rounded-full', i < step ? 'bg-pink' : 'bg-line')} />
          ))}
        </div>
        <p className="h-5 text-sm text-red" aria-live="polite">
          {error ?? (step === 2 && !fixedValid ? '금액을 넣은 고정지출에 이름을 적어 주세요' : '')}
        </p>
        {step === 1 && (
          <Button onClick={() => setStep(2)}>다음: 월급·고정지출</Button>
        )}
        {step === 2 && (
          <Button onClick={() => setStep(3)} disabled={!fixedValid}>
            다음: 통 나누기
          </Button>
        )}
        {step === 3 && (
          <Button onClick={submit} disabled={pending}>
            {pending ? '저장 중…' : '이번 달 시작 ♡'}
          </Button>
        )}
        {/* 2단계의 '이전'이 월급일·확정일 수정 진입로다 */}
        {step > 1 && (
          <Button variant="text" onClick={() => setStep((s) => (s - 1) as Step)} disabled={pending}>
            {step === 2 ? '월급일·확정일 바꾸기' : '이전'}
          </Button>
        )}
      </div>
    </div>
  )
}

function DayField({ label, desc, value, onChange }: { label: string; desc: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-4">
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rounded-xl bg-soft px-3 py-2 text-lg font-bold text-deep outline-none"
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
  )
}
