import { describe, expect, it } from 'vitest'
import { billCashAmount, computeCashflow, splitFixed, summarizeBills, type CardBill, type FixedItem, type Reserve } from './cashflow'
import { cycleFor, nextCycle } from './cycle'

const cycle = cycleFor('2026-11-10', 5) // 11/5 ~ 12/4
const next = nextCycle(cycle, 5) // 12/5 ~ 1/4
const SALARY = 2_975_244
const bill = (dueDate: string, amount: number, extra: Partial<CardBill> = {}): CardBill => ({
  dueDate,
  amount,
  paidAmount: 0,
  includesCardFixed: true,
  ...extra,
})
// 검증용 실제 숫자
const NOV_BILL = bill('2026-11-05', 1_024_984)
const DEC_BILL = bill('2026-12-05', 772_358)
const run = (fixed: FixedItem[], bills: CardBill[] = [NOV_BILL, DEC_BILL]) =>
  computeCashflow({ salary: SALARY, fixed, bills, cycle, nextCycle: next })

describe('검증용 데이터 (고정지출 1,500,315원, 결제 수단 미분류)', () => {
  const r = run([{ amount: 1_500_315, method: null }])
  it('미분류는 계좌 출금으로 계산 (기존 계산과 같은 쪽, 임의로 카드로 보지 않음)', () =>
    expect(r.fixed).toEqual({ account: 0, card: 0, unclassified: 1_500_315, unclassifiedCount: 1, cashOut: 1_500_315 }))
  it('이번 주기 현금 = 2,975,244 − 1,500,315 − 1,024,984', () => expect(r.cash).toBe(449_945))
  it('다음 주기 예상 현금 = 2,975,244 − 1,500,315 − 772,358', () => expect(r.nextCash).toBe(702_571))
})

describe('계좌 출금 고정지출만 있는 경우', () => {
  it('고정지출 전액이 현금에서 빠지고 카드 대금은 그대로', () => {
    const r = run([{ amount: 1_500_315, method: 'account' }])
    expect(r.cash).toBe(449_945)
    expect(r.fixed.card).toBe(0)
  })
})

describe('카드 고정지출이 카드 대금에 포함된 경우 (중복 차감 방지)', () => {
  const fixed: FixedItem[] = [
    { amount: 1_200_315, method: 'account' },
    { amount: 300_000, method: 'card' },
  ]
  it('카드 고정지출 300,000원은 현금에서 따로 빼지 않는다', () => {
    const r = run(fixed)
    expect(r.cash).toBe(SALARY - 1_200_315 - 1_024_984)
    expect(r.cash - run([{ amount: 1_500_315, method: 'account' }]).cash).toBe(300_000)
  })
  it('다음 주기 대금도 카드 고정지출을 다시 더하지 않는다', () => expect(run(fixed).nextCash).toBe(SALARY - 1_200_315 - 772_358))
  it('대금이 확정 전이라 카드 고정지출이 아직 없으면 그 대금에만 한 번 더한다', () => {
    const r = run(fixed, [NOV_BILL, bill('2026-12-05', 772_358, { includesCardFixed: false })])
    expect(r.nextBill.amount).toBe(1_072_358)
    expect(r.nextCash).toBe(SALARY - 1_200_315 - 1_072_358)
    expect(r.cash).toBe(SALARY - 1_200_315 - 1_024_984) // 이번 주기는 그대로
  })
})

describe('카드 대금이 다음 급여 주기에 출금되는 경우', () => {
  it('12/5 대금은 이번 주기 현금에서 빠지지 않는다', () => {
    const withDec = run([{ amount: 1_500_315, method: 'account' }])
    const withoutDec = run([{ amount: 1_500_315, method: 'account' }], [NOV_BILL])
    expect(withDec.cash).toBe(withoutDec.cash)
    expect(withDec.nextBill).toEqual({ dueDate: '2026-12-05', amount: 772_358, reserved: 0, fromCash: 772_358, paid: 0, remaining: 772_358 })
  })
})

describe('월급일과 카드 출금일이 같은 경우', () => {
  it('월급일 당일 출금은 이번 주기, 다음 월급일 출금은 다음 주기', () => {
    expect(summarizeBills([NOV_BILL, DEC_BILL], cycle, 0).amount).toBe(1_024_984)
    expect(summarizeBills([NOV_BILL, DEC_BILL], next, 0).amount).toBe(772_358)
  })
  it('주기 마지막 날(12/4) 출금은 이번 주기', () =>
    expect(summarizeBills([bill('2026-12-04', 10)], cycle, 0).amount).toBe(10))
})

describe('카드 출금일 변경 및 청구액 수정', () => {
  it('출금일이 12/5 → 12/8 로 밀려도 다음 주기', () =>
    expect(summarizeBills([bill('2026-12-08', 772_358)], next, 0).amount).toBe(772_358))
  it('출금일이 12/3 으로 당겨지면 이번 주기 현금에서 빠진다', () => {
    const r = run([{ amount: 1_500_315, method: 'account' }], [NOV_BILL, bill('2026-12-03', 772_358)])
    expect(r.cash).toBe(449_945 - 772_358)
    expect(r.nextBill.amount).toBe(0)
  })
  it('청구액을 고치면 그 값으로 다시 계산', () =>
    expect(run([{ amount: 1_500_315, method: 'account' }], [bill('2026-11-05', 1_000_000), DEC_BILL]).cash).toBe(474_929))
})

describe('카드 대금 일부가 이미 출금된 경우', () => {
  const r = run([{ amount: 1_500_315, method: 'account' }], [bill('2026-11-05', 1_024_984, { paidAmount: 500_000 }), DEC_BILL])
  it('이미 빠진 돈을 다시 빼지 않는다 (현금은 출금 여부와 무관)', () => expect(r.cash).toBe(449_945))
  it('남은 출금만 따로 보인다', () => expect(r.thisBill).toMatchObject({ paid: 500_000, remaining: 524_984 }))
  it('출금액이 청구액보다 커도 남은 출금은 0 아래로 내려가지 않는다', () =>
    expect(summarizeBills([bill('2026-11-05', 100, { paidAmount: 150 })], cycle, 0)).toMatchObject({ paid: 100, remaining: 0 }))
})

describe('기존 데이터 (결제 수단 없음)', () => {
  it('일부만 분류해도 미분류는 계좌로, 건수를 센다', () =>
    expect(splitFixed([{ amount: 1, method: 'account' }, { amount: 2, method: 'card' }, { amount: 3, method: null }, { amount: 4, method: null }])).toEqual({
      account: 1,
      card: 2,
      unclassified: 7,
      unclassifiedCount: 2,
      cashOut: 8,
    }))
})

describe('billCashAmount', () => {
  it('포함됨이면 그대로', () => expect(billCashAmount(bill('2026-11-05', 100), 30)).toBe(100))
  it('미포함이면 카드 고정지출을 더한다', () => expect(billCashAmount(bill('2026-11-05', 100, { includesCardFixed: false }), 30)).toBe(130))
})

describe('카드 결제 준비금 (이미 소비 예산에서 뺀 카드 구매는 대금 출금 때 다시 빼지 않는다)', () => {
  const fixed: FixedItem[] = [{ amount: 1_500_315, method: 'account' }]
  const runR = (bills: CardBill[], reserves: Reserve[]) =>
    computeCashflow({ salary: SALARY, fixed, bills, cycle, nextCycle: next, reserves })

  it('11/10 에 산 50,000원(12/5 출금)은 다음 주기 예상 현금에서 다시 빠지지 않는다', () => {
    const r = runR([NOV_BILL, bill('2026-12-05', 822_358)], [{ dueDate: '2026-12-05', amount: 50_000 }])
    expect(r.nextBill).toMatchObject({ amount: 822_358, reserved: 50_000, fromCash: 772_358 })
    expect(r.nextCash).toBe(702_571) // 산 것이 없을 때와 같다
    expect(r.cash).toBe(449_945)
  })

  it('확정일 뒤에 산 것(1/5 출금)은 12/5 대금과 무관', () => {
    const r = runR([NOV_BILL, DEC_BILL], [{ dueDate: '2027-01-05', amount: 50_000 }])
    expect(r.nextBill).toMatchObject({ reserved: 0, fromCash: 772_358 })
  })

  it('지난 주기에 준비해 둔 구매가 이번 대금에 들어 있으면 이번 현금에서 그만큼 덜 뺀다', () => {
    const r = runR([NOV_BILL, DEC_BILL], [{ dueDate: '2026-11-05', amount: 100_000 }])
    expect(r.thisBill).toMatchObject({ amount: 1_024_984, reserved: 100_000, fromCash: 924_984 })
    expect(r.cash).toBe(549_945)
  })

  it('같은 주기 안에 출금되는 구매도 한 번만 (확정일 10·출금일 25 같은 카드)', () => {
    const r = runR([bill('2026-11-25', 300_000)], [{ dueDate: '2026-11-25', amount: 50_000 }])
    expect(r.cash).toBe(SALARY - 1_500_315 - 250_000)
  })

  it('준비금이 대금보다 크면(카드 앱 숫자로 낮춰 적음) 현금에서 0 을 뺀다', () => {
    const r = runR([bill('2026-12-05', 30_000)], [{ dueDate: '2026-12-05', amount: 50_000 }])
    expect(r.nextBill).toMatchObject({ reserved: 30_000, fromCash: 0 })
  })

  it('11월 첫 전환: 준비금이 없으면 11/5 대금은 전액 이번 월급에서 (기존 카드 대금 정리)', () =>
    expect(runR([NOV_BILL, DEC_BILL], []).cash).toBe(449_945))
})
