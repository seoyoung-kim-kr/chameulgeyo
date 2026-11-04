// 급여 주기별 현금 흐름. 순수 함수만 둔다 (DB·날짜 생성 없음).
//
// 원칙 (2026-11-05, 기획서 7번 개정)
// - 현금은 "주기 시작(월급일) 기준"으로 센다. 이번 주기에 빠질 돈은 이미 빠졌든 아니든 한 번만 뺀다.
//   출금 완료 여부는 "남은 출금"을 보여줄 때만 쓴다 → 이미 빠진 돈을 다시 빼는 일이 없다.
// - 계좌 출금 고정지출은 현금에서 뺀다. 결제 수단을 모르는(미분류) 항목도 계좌로 본다(기존 계산과 같은 쪽).
// - 카드 고정지출은 현금에서 따로 빼지 않는다. 카드 대금 안에 들어 있기 때문이다.
//   대금이 아직 확정 전이라 카드 고정지출이 빠져 있으면(includesCardFixed=false) 그 대금에 한 번 더한다.
// - 카드 대금은 출금일이 속한 주기의 현금에서 뺀다. 다음 주기 대금은 이번 주기 현금에서 빼지 않는다.

import { inCycle, type Cycle } from './cycle'

export type PaymentMethod = 'account' | 'card'

export type FixedItem = { amount: number; method: PaymentMethod | null }

export type CardBill = {
  /** 실제 출금(예정)일 'YYYY-MM-DD' */
  dueDate: string
  /** 청구(예정)액 */
  amount: number
  /** 이미 출금된 금액 (0 ~ amount) */
  paidAmount: number
  /** 이 금액에 카드 고정지출(통신비·구독 등)이 이미 들어 있는지 */
  includesCardFixed: boolean
}

export type FixedSplit = {
  account: number
  card: number
  unclassified: number
  unclassifiedCount: number
  /** 현금에서 빼는 고정지출 = 계좌 + 미분류 */
  cashOut: number
}

export function splitFixed(items: FixedItem[]): FixedSplit {
  let account = 0
  let card = 0
  let unclassified = 0
  let unclassifiedCount = 0
  for (const f of items) {
    if (f.method === 'account') account += f.amount
    else if (f.method === 'card') card += f.amount
    else {
      unclassified += f.amount
      unclassifiedCount += 1
    }
  }
  return { account, card, unclassified, unclassifiedCount, cashOut: account + unclassified }
}

/** 대금 하나가 현금에서 빠지는 금액. 카드 고정지출이 아직 안 들어 있으면 한 번 더한다. */
export function billCashAmount(bill: CardBill, cardFixed: number): number {
  return bill.amount + (bill.includesCardFixed ? 0 : cardFixed)
}

export type BillSummary = {
  /** 주기 안 가장 이른 출금일 (없으면 null = 아직 입력 안 함) */
  dueDate: string | null
  /** 현금에서 빠지는 총액 */
  amount: number
  /** 이미 출금된 금액 */
  paid: number
  /** 앞으로 빠질 금액 */
  remaining: number
}

export function summarizeBills(bills: CardBill[], cycle: Cycle, cardFixed: number): BillSummary {
  const mine = bills.filter((b) => inCycle(b.dueDate, cycle)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  let amount = 0
  let paid = 0
  for (const b of mine) {
    const cash = billCashAmount(b, cardFixed)
    amount += cash
    paid += Math.min(Math.max(b.paidAmount, 0), cash)
  }
  return { dueDate: mine[0]?.dueDate ?? null, amount, paid, remaining: amount - paid }
}

export type CashflowInput = {
  salary: number
  fixed: FixedItem[]
  bills: CardBill[]
  cycle: Cycle
  nextCycle: Cycle
}

export type Cashflow = {
  fixed: FixedSplit
  thisBill: BillSummary
  nextBill: BillSummary
  /** 이번 주기 현금 = 월급 − 계좌 출금 고정지출 − 이번 주기 카드 대금 */
  cash: number
  /** 다음 주기 예상 현금 = 월급 − 계좌 출금 고정지출 − 다음 주기 카드 대금 (다음 월급은 이번과 같다고 본다) */
  nextCash: number
}

export function computeCashflow(i: CashflowInput): Cashflow {
  const fixed = splitFixed(i.fixed)
  const thisBill = summarizeBills(i.bills, i.cycle, fixed.card)
  const nextBill = summarizeBills(i.bills, i.nextCycle, fixed.card)
  return {
    fixed,
    thisBill,
    nextBill,
    cash: i.salary - fixed.cashOut - thisBill.amount,
    nextCash: i.salary - fixed.cashOut - nextBill.amount,
  }
}
