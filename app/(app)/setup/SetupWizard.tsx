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
import { computeCashflow, type PaymentMethod } from '@/lib/cashflow'
import { cardDueDate, cycleFor, inCycle, nextCycle, shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import type { ReserveRow } from '@/lib/ledger'
import { FIXED_MAX_COUNT, FIXED_NAME_MAX, type SaveMonthInput } from '@/lib/validation'
import { logout, saveMonth, setHideAmounts } from './actions'

type Props = {
  defaults: SaveMonthInput
  today: string
  /** 이미 저장된 대금의 출금일 (없으면 카드 출금일로 계산) */
  thisBillDue: string | null
  nextBillDue: string | null
  /** 카드 결제 준비금 (이미 예산에서 뺀 카드 구매) + 그 구매에서 다음 달로 미룬 금액 */
  reserves: ReserveRow[]
  /** 홈에서 월급·고정지출·카드값을 가리는지 */
  hideAmounts: boolean
  /** 처음 쓰는 경우에만 날짜 단계부터 시작한다 */
  isFirst: boolean
}

type FixedRow = { key: number; name: string; amount: number; method: PaymentMethod | null }
type Step = 1 | 2 | 3

const TOTAL_STEPS = 3
const LIVING_STEP = 10_000
const STEP_TITLES: Record<Step, string> = { 1: '기본 설정', 2: '수입과 지출', 3: '예산 나누기' }

const ERRORS: Record<string, string> = {
  INVALID: '입력한 값을 다시 확인해 주세요.',
  DB: '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.',
}

export function SetupWizard({ defaults, today, thisBillDue, nextBillDue, reserves, hideAmounts, isFirst }: Props) {
  const router = useRouter()
  const firstStep: Step = isFirst ? 1 : 2
  const [step, setStep] = useState<Step>(firstStep)
  const [payDay, setPayDay] = useState(defaults.payDay)
  const [cardCutoffDay, setCardCutoffDay] = useState(defaults.cardCutoffDay)
  const [cardPayDay, setCardPayDay] = useState(defaults.cardPayDay)
  const [salary, setSalary] = useState(defaults.salary)
  const [thisBill, setThisBill] = useState(defaults.thisBill)
  const [nextBill, setNextBill] = useState(defaults.nextBill)
  const [livingTarget, setLivingTarget] = useState(defaults.livingTarget)
  const [emergencyAmount, setEmergencyAmount] = useState(defaults.emergencyAmount)
  const [fixed, setFixed] = useState<FixedRow[]>(() => defaults.fixed.map((f, i) => ({ key: i, ...f })))
  const [nextKey, setNextKey] = useState(defaults.fixed.length)
  const [error, setError] = useState<string | null>(null)
  const [hide, setHide] = useState(hideAmounts)
  const [hidePending, startHide] = useTransition()

  // 누르는 즉시 저장한다. 실패하면 되돌린다
  const toggleHide = () => {
    const nextValue = !hide
    setHide(nextValue)
    setError(null)
    startHide(async () => {
      const result = await setHideAmounts(nextValue)
      if (!result.ok) {
        if (result.error === 'UNAUTHORIZED') return router.replace('/login')
        setHide(!nextValue)
        setError(ERRORS[result.error] ?? ERRORS.DB)
      }
    })
  }
  const [pending, startTransition] = useTransition()

  // 월급일을 바꾸면 주기도 바뀐다. 날짜 계산은 lib/cycle 에만 둔다.
  const cycle = useMemo(() => cycleFor(today, payDay), [today, payDay])
  const next = useMemo(() => nextCycle(cycle, payDay), [cycle, payDay])
  const thisDue = thisBillDue ?? cardDueDate(cycle, cardPayDay)
  const nextDue = nextBillDue ?? cardDueDate(next, cardPayDay)
  const fixedTotal = fixed.reduce((sum, f) => sum + f.amount, 0)
  // 서버와 같은 순수 함수로 미리 계산한다 (카드 고정지출은 대금에 들어 있으므로 현금에서 따로 빼지 않는다)
  const cashflow = computeCashflow({
    salary,
    fixed,
    bills: [
      { dueDate: thisDue, amount: thisBill, paidAmount: 0, includesCardFixed: true },
      { dueDate: nextDue, amount: nextBill, paidAmount: 0, includesCardFixed: true },
    ],
    cycle,
    nextCycle: next,
    reserves,
  })
  const budget = computeBudget({ cash: cashflow.cash, livingTarget, emergencyAmount, spentShopping: 0, cycleDays: cycle.days })
  // 지난 달에 예산을 넘겨 카드로 산 금액 중 이번 카드값에 들어 있는 것 (이번 월급에서 빠진다)
  const carried = reserves.filter((r) => inCycle(r.dueDate, cycle)).reduce((sum, r) => sum + r.deferred, 0)
  const unclassified = fixed.filter((f) => (f.name.trim() !== '' || f.amount > 0) && f.method === null).length
  // 이름 없는 0원 줄은 빈 줄로 보고 버린다. 금액만 있고 이름이 없으면 진행을 막는다.
  const filledFixed = fixed.filter((f) => f.name.trim() !== '' || f.amount > 0)
  const fixedValid = filledFixed.every((f) => f.name.trim() !== '')
  const livingMax = Math.max(budget.available, 0)
  const livingPct = livingMax === 0 ? 0 : (Math.min(livingTarget, livingMax) / livingMax) * 100

  const updateFixed = (key: number, patch: Partial<FixedRow>) =>
    setFixed((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const moveFixed = (key: number, dir: -1 | 1) =>
    setFixed((rows) => {
      const i = rows.findIndex((r) => r.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= rows.length) return rows
      const copy = [...rows]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  const addFixed = () => {
    setFixed((rows) => [...rows, { key: nextKey, name: '', amount: 0, method: null }])
    setNextKey((k) => k + 1)
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveMonth({
        payDay,
        cardCutoffDay,
        cardPayDay,
        salary,
        thisBill,
        nextBill,
        livingTarget,
        emergencyAmount,
        fixed: filledFixed.map(({ name, amount, method }) => ({ name: name.trim(), amount, method })),
      })
      if (!result.ok) {
        if (result.error === 'UNAUTHORIZED') return router.replace('/login')
        setError(ERRORS[result.error] ?? ERRORS.DB)
      }
      // 성공하면 액션이 서버에서 홈으로 redirect 해 여기로 돌아오지 않는다
    })
  }

  const message =
    error ??
    (step === 2 && !fixedValid
      ? '고정지출 이름을 입력해 주세요.'
      : step === 2 && unclassified > 0
        ? `결제 수단을 고르지 않은 고정지출이 ${unclassified}건 있어요.\n고르기 전까지는 계좌 출금으로 계산해요.`
        : null)

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
          <DayField label="카드값 출금일" value={cardPayDay} onChange={setCardPayDay} />
          <Card>
            <div className="flex items-center justify-between gap-3">
              <span id="hide-amounts-label" className="font-bold">
                홈에서 월급·고정지출·카드값 가리기
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={hide}
                aria-labelledby="hide-amounts-label"
                onClick={toggleHide}
                disabled={hidePending}
                className={clsx(
                  'relative h-8 w-14 shrink-0 rounded-full transition-colors motion-reduce:transition-none disabled:opacity-60',
                  hide ? 'bg-pink' : 'bg-line',
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none',
                    hide && 'translate-x-6',
                  )}
                />
              </button>
            </div>
          </Card>
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
              <ul className="flex flex-col divide-y divide-line">
                {fixed.map((f, i) => (
                  <li key={f.key} className="grid grid-cols-[minmax(0,1fr)_5rem_2rem] items-center gap-2 py-3 first:pt-0">
                    <TextInput
                      aria-label="항목 이름"
                      placeholder="항목 이름"
                      maxLength={FIXED_NAME_MAX}
                      value={f.name}
                      invalid={f.amount > 0 && f.name.trim() === ''}
                      onChange={(e) => updateFixed(f.key, { name: e.target.value })}
                    />
                    <select
                      aria-label={`${f.name || '항목'} 결제 수단`}
                      value={f.method ?? ''}
                      onChange={(e) => updateFixed(f.key, { method: (e.target.value || null) as PaymentMethod | null })}
                      className={clsx(
                        'h-12 rounded-xl border bg-white px-2 text-sm outline-none focus:border-pink',
                        f.method === null ? 'border-red text-red' : 'border-line text-ink',
                      )}
                    >
                      <option value="">선택</option>
                      <option value="account">계좌</option>
                      <option value="card">카드</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`${f.name || '항목'} 삭제`}
                      className="flex size-8 items-center justify-center rounded-full text-lg text-muted active:bg-soft"
                      onClick={() => setFixed((rows) => rows.filter((r) => r.key !== f.key))}
                    >
                      ×
                    </button>
                    <MoneyInput label={`${f.name || '항목'} 금액`} value={f.amount} onChange={(amount) => updateFixed(f.key, { amount })} />
                    <div className="col-span-2 flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`${f.name || '항목'} 위로`}
                        disabled={i === 0}
                        className="flex size-8 items-center justify-center rounded-full text-muted active:bg-soft disabled:opacity-30"
                        onClick={() => moveFixed(f.key, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`${f.name || '항목'} 아래로`}
                        disabled={i === fixed.length - 1}
                        className="flex size-8 items-center justify-center rounded-full text-muted active:bg-soft disabled:opacity-30"
                        onClick={() => moveFixed(f.key, 1)}
                      >
                        ▼
                      </button>
                    </div>
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
            <div className="flex flex-col gap-4">
              <Field label="이번 카드값" aside={<span>{shortDate(thisDue)} 출금</span>}>
                <MoneyInput label="이번 카드값" value={thisBill} onChange={setThisBill} />
                {carried > 0 && (
                  <p className="mt-2 text-xs text-red">지난 달에 예산을 넘겨 카드로 산 {formatWon(carried)}원이 들어 있어요. 이번 월급에서 빠져요.</p>
                )}
              </Field>
              <Field label="다음 카드값" aside={<span>{shortDate(nextDue)} 출금 예정</span>}>
                <MoneyInput label="다음 카드값" value={nextBill} onChange={setNextBill} />
              </Field>
            </div>
          </Card>

          <Card tone="tint">
            <p className="text-sm text-muted">
              이번 주기에 쓸 수 있는 돈 · {shortDate(cycle.start)}~{shortDate(cycle.end)}
            </p>
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
            <p className="text-sm text-muted">
              이번 주기에 쓸 수 있는 돈 · {shortDate(cycle.start)}~{shortDate(cycle.end)}
            </p>
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
        {step === 1 && (
          <form action={logout} className="flex justify-center">
            <Button type="submit" variant="text" disabled={pending}>
              로그아웃
            </Button>
          </form>
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
