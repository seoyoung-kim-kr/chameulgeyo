import { describe, expect, it } from 'vitest'
import { canBuy, computeBudget, judge } from './budget'
import { computeCashflow, type CardBill, type Reserve } from './cashflow'
import { cycleFor, nextCycle, statementDueDate } from './cycle'

// 카드 구매 → 예산 → 카드값 출금까지 한 흐름을 순수 함수 조합으로 따라간다
// (docs/requests/2026-11-06-calculation-audit.md 2·4절). DB 를 거치는 부분(lib/ledger.ts)은
// 여기서 만든 값과 같은 모양을 넘긴다고 본다.
//
// 설정: 월급일 5, 확정일 24, 출금일 5. 월급 3,000,000, 계좌 고정지출 1,000,000.
// 11월 주기 11/5~12/4, 12월 주기 12/5~1/4. 12/5 카드값(카드 앱 숫자) 640,000.

const PAY_DAY = 5
const CUTOFF = 24
const CARD_PAY = 5
const SALARY = 3_000_000
const FIXED = [{ amount: 1_000_000, method: 'account' as const }]
const LIVING = 1_200_000
const EMERGENCY = 100_000

const nov = cycleFor('2026-11-10', PAY_DAY)
const dec = nextCycle(nov, PAY_DAY)
const jan = nextCycle(dec, PAY_DAY)

const bill = (dueDate: string, amount: number): CardBill => ({ dueDate, amount, paidAmount: 0, includesCardFixed: true })

/** 한 주기의 장부: 현금 → 예산 → 판정 문맥. lib/ledger.ts computeLedger + lib/decisions.ts loadJudgeContext 와 같은 조립 */
function ledger(cycle: ReturnType<typeof cycleFor>, bills: CardBill[], reserves: Reserve[], spent: { total: number; deferred: number }) {
  const next = nextCycle(cycle, PAY_DAY)
  const cashflow = computeCashflow({ salary: SALARY, fixed: FIXED, bills, cycle, nextCycle: next, reserves })
  const budget = computeBudget({
    cash: cashflow.cash,
    livingTarget: LIVING,
    emergencyAmount: EMERGENCY,
    spentShopping: spent.total,
    deferred: spent.deferred,
    cycleDays: cycle.days,
  })
  const ctx = {
    shoppingRaw: budget.shoppingRaw,
    deferred: budget.deferred,
    livingTarget: LIVING,
    emergencyAmount: EMERGENCY,
    cycleDays: cycle.days,
    nextCash: cashflow.nextCash,
    nextCycleDays: next.days,
  }
  return { cashflow, budget, ctx }
}

/** 11/5 카드값은 이미 정리됐고(500,000) 12/5 카드값은 카드 앱 기준 640,000 */
const base = [bill('2026-11-05', 500_000), bill('2026-12-05', 640_000)]

describe('11월 주기 시작: 카드값·고정지출만 있을 때', () => {
  const l = ledger(nov, base, [], { total: 0, deferred: 0 })
  it('배분할 돈 = 월급 − 계좌 고정지출 − 11/5 카드값', () => expect(l.cashflow.cash).toBe(1_500_000))
  it('쇼핑 예산 = 배분할 돈 − 생활비 − 예비비 = 200,000', () => expect(l.budget.shopping).toBe(200_000))
  it('다음 주기 예상 현금은 12/5 카드값 전액을 뺀 값', () => expect(l.cashflow.nextCash).toBe(SALARY - 1_000_000 - 640_000))
})

describe('시나리오 1. 예산 안에서 카드로 산다 (초록, 150,000)', () => {
  const l0 = ledger(nov, base, [], { total: 0, deferred: 0 })
  const v = judge(150_000, l0.ctx)
  const due = statementDueDate('2026-11-10', CUTOFF, CARD_PAY)
  // 산 뒤: 12/5 카드값 +150,000, 준비금 150,000, 이번 주기 소비 150,000
  const after = ledger(nov, [base[0], bill('2026-12-05', 640_000 + 150_000)], [{ dueDate: due, amount: v.reserve }], { total: 150_000, deferred: 0 })

  it('초록, 전액을 이번 주기 예산으로 묶는다', () => expect(v).toMatchObject({ verdict: 'green', reserve: 150_000, overAmount: 0 }))
  it('출금일은 12/5 (다음 주기)', () => expect(due).toBe('2026-12-05'))
  it('이번 주기 현금은 그대로 (카드는 지금 통장에서 안 나간다)', () => expect(after.cashflow.cash).toBe(1_500_000))
  it('쇼핑 예산만 150,000 줄고 생활비는 그대로', () => expect(after.budget).toMatchObject({ shopping: 50_000, livingNow: LIVING }))
  it('다음 카드값은 늘었지만 남겨둘 돈 150,000 을 빼서 다음 월급에서 낼 돈은 640,000 그대로', () =>
    expect(after.cashflow.nextBill).toMatchObject({ amount: 790_000, reserved: 150_000, fromCash: 640_000 }))
  it('다음 주기 예상 현금 변화 없음 = 같은 구매가 두 번 빠지지 않는다', () => expect(after.cashflow.nextCash).toBe(l0.cashflow.nextCash))
})

describe('시나리오 2. 예산을 넘겨 카드로 산다 (쇼핑 200,000 남았는데 350,000)', () => {
  const l0 = ledger(nov, base, [], { total: 0, deferred: 0 })
  const v = judge(350_000, l0.ctx)
  const after = ledger(nov, [base[0], bill('2026-12-05', 640_000 + 350_000)], [{ dueDate: '2026-12-05', amount: v.reserve }], {
    total: 350_000,
    deferred: v.overAmount,
  })

  it('빨강. 남은 예산 200,000 은 남겨둘 돈, 넘긴 150,000 은 다음 월급 몫', () =>
    expect(v).toMatchObject({ verdict: 'red', overAmount: 150_000, reserve: 200_000 }))
  it('카드로 살 수 있다 (다음 달 생활비 1,200,000 − 150,000 ≥ 0)', () => {
    expect(v).toMatchObject({ nextLivingNow: LIVING, nextLivingAfter: LIVING - 150_000 + 60_000 })
    expect(canBuy(v, 'card')).toBe(true)
  })
  it('쇼핑 예산은 −150,000 으로 보이고 이번 달 생활비는 그대로', () =>
    expect(after.budget).toMatchObject({ shoppingRaw: -150_000, shoppingExhausted: true, deferred: 150_000, livingNow: LIVING }))
  it('이번 주기 현금은 그대로', () => expect(after.cashflow.cash).toBe(1_500_000))
  it('다음 카드값 990,000 = 남겨둘 돈 200,000 + 다음 월급에서 낼 돈 790,000 (넘긴 150,000 포함)', () =>
    expect(after.cashflow.nextBill).toMatchObject({ amount: 990_000, reserved: 200_000, fromCash: 790_000 }))
  it('다음 주기 예상 현금은 넘긴 150,000 만큼만 줄어든다', () => expect(after.cashflow.nextCash).toBe(l0.cashflow.nextCash - 150_000))
})

describe('시나리오 3. 결제일 출금: 12월 주기에서 본 12/5 카드값', () => {
  // 11월에 350,000 카드 구매(남겨둘 돈 200,000, 넘긴 150,000). 12월 주기에서는 이 구매가 소비에 들어가지 않는다 (11월 기록)
  const reserves: Reserve[] = [{ dueDate: '2026-12-05', amount: 200_000 }]
  const l = ledger(dec, [bill('2026-12-05', 990_000), bill('2027-01-05', 600_000)], reserves, { total: 0, deferred: 0 })

  it('12/5 카드값 990,000 중 남겨둔 200,000 은 11월 돈으로 내고, 790,000 만 12월 월급에서 뺀다', () =>
    expect(l.cashflow.thisBill).toMatchObject({ amount: 990_000, reserved: 200_000, fromCash: 790_000 }))
  it('12월 배분할 돈 = 3,000,000 − 1,000,000 − 790,000', () => expect(l.cashflow.cash).toBe(1_210_000))
  it('12월 쇼핑 예산(원래 60,000)은 11월에 넘긴 150,000 만큼 줄어 −90,000, 모자란 90,000 은 12월 생활비에서', () =>
    expect(l.budget).toMatchObject({ shoppingRaw: -90_000, deferred: 0, livingNow: LIVING - 90_000 }))
  it('11월 판정이 예고한 다음 달 생활비와 같다', () => {
    const novV = judge(350_000, ledger(nov, base, [], { total: 0, deferred: 0 }).ctx)
    expect(novV.nextLivingAfter).toBe(l.budget.livingNow)
  })
  it('11월 구매는 12월 소비(spentShopping)에 들어가지 않는다: 넘긴 돈은 카드값 경로로만 한 번 빠진다', () =>
    expect(l.cashflow.cash + 150_000).toBe(SALARY - 1_000_000 - 640_000))
})

describe('시나리오 4. 확정일 뒤에 산 카드 구매는 다다음 주기에 출금', () => {
  const due = statementDueDate('2026-11-26', CUTOFF, CARD_PAY)
  it('11/26 구매 → 1/5 출금', () => expect(due).toBe('2027-01-05'))
  it('11월·12월 카드값에는 안 들어가고 1월 주기 현금에서 빠진다', () => {
    const reserves: Reserve[] = [{ dueDate: due, amount: 100_000 }]
    const novL = ledger(nov, [...base, bill(due, 100_000)], reserves, { total: 100_000, deferred: 0 })
    expect(novL.cashflow.nextBill.amount).toBe(640_000)
    const janL = ledger(jan, [bill(due, 100_000)], reserves, { total: 0, deferred: 0 })
    expect(janL.cashflow.thisBill).toMatchObject({ amount: 100_000, reserved: 100_000, fromCash: 0 })
  })
})

describe('시나리오 5. 남겨둔 돈을 다시 쓸 수 없다', () => {
  // 쇼핑 200,000 을 전부 카드 구매로 묶은 뒤 현금으로 또 사려는 경우
  const l = ledger(nov, [base[0], bill('2026-12-05', 840_000)], [{ dueDate: '2026-12-05', amount: 200_000 }], { total: 200_000, deferred: 0 })
  it('쇼핑 예산 0', () => expect(l.budget.shopping).toBe(0))
  it('1원도 빨강이고, 현금으로 사면 생활비에서 나간다 (남겨둔 돈이 아니라)', () => {
    const v = judge(50_000, l.ctx)
    expect(v).toMatchObject({ verdict: 'red', overAmount: 50_000, reserve: 0, livingAfter: LIVING - 50_000 })
    expect(canBuy(v, 'account')).toBe(true)
  })
  it('현금 구매 뒤 남겨둔 돈은 그대로 200,000 (다음 월급에서 낼 돈 불변)', () => {
    const after = ledger(nov, [base[0], bill('2026-12-05', 840_000)], [{ dueDate: '2026-12-05', amount: 200_000 }], { total: 250_000, deferred: 0 })
    expect(after.budget).toMatchObject({ shoppingRaw: -50_000, livingNow: LIVING - 50_000 })
    expect(after.cashflow.nextBill).toMatchObject({ reserved: 200_000, fromCash: 640_000 })
  })
})

describe('시나리오 6. 생활비 보호', () => {
  const l = ledger(nov, base, [], { total: 0, deferred: 0 })
  it('현금으로 사서 이번 달 생활비가 0 밑으로 가면 막힌다', () => {
    const v = judge(200_000 + LIVING + 1, l.ctx)
    expect(v.livingExhausted).toBe(true)
    expect(canBuy(v, 'account')).toBe(false)
  })
  it('카드로 미뤄서 다음 달 생활비가 0 밑으로 가면 막힌다', () => {
    // 다음 달 쇼핑 = 1,360,000 − 1,300,000 = 60,000. 그 위로 생활비 1,200,000 까지 미룰 수 있다
    const ok = judge(200_000 + 60_000 + LIVING, l.ctx)
    expect(ok).toMatchObject({ nextLivingAfter: 0, nextLivingExhausted: false })
    const no = judge(200_000 + 60_000 + LIVING + 1, l.ctx)
    expect(no).toMatchObject({ nextLivingAfter: -1, nextLivingExhausted: true })
    expect(canBuy(no, 'card')).toBe(false)
  })
})

describe('시나리오 7. 카드 앱 숫자로 카드값을 덮어쓴 뒤', () => {
  it('카드사에 아직 안 올라온 구매는 남겨둘 돈이 카드값보다 커도 월급에서 0 만 뺀다 (음수 아님)', () => {
    const l = ledger(nov, [base[0], bill('2026-12-05', 100_000)], [{ dueDate: '2026-12-05', amount: 200_000 }], { total: 200_000, deferred: 0 })
    expect(l.cashflow.nextBill).toMatchObject({ amount: 100_000, reserved: 100_000, fromCash: 0 })
  })
  it('이번 카드값을 올려 적어 생활비가 마이너스가 되면 판정은 현금 구매를 막는다', () => {
    const l = ledger(nov, [bill('2026-11-05', 1_950_000), base[1]], [], { total: 0, deferred: 0 })
    // 배분할 돈 50,000 뿐이라 생활비가 이미 −50,000. 현금 구매는 1원도 막힌다
    expect(l.budget).toMatchObject({ available: 50_000, shoppingRaw: -1_250_000, livingNow: -50_000 })
    expect(canBuy(judge(1, l.ctx), 'account')).toBe(false)
  })
})
