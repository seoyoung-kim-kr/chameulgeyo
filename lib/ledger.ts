// 급여 주기 장부를 DB 에서 읽어 계산한다. 세션 검사는 하지 않는다 (호출하는 쪽 책임):
// - lib/queries.ts (화면 조회, requireUserId 후 호출)
// - lib/decisions.ts (판정·선택, 서버 액션 withUser 안에서 호출)
// 모든 함수가 userId 를 필수로 받아 그 사용자 행만 읽는다.
// 계산 자체는 lib/cashflow.ts · lib/budget.ts 의 순수 함수가 한다.
import { and, asc, eq, gte, isNull, lte, not, or } from 'drizzle-orm'
import { db } from '@/db'
import { cardBills, decisions, fixedExpenses, months, settings } from '@/db/schema'
import { computeBudget, type Budget } from './budget'
import { computeCashflow, type CardBill, type Cashflow, type Reserve } from './cashflow'
import { cycleFor, daysBetween, inCycle, nextCycle, statementDueDate, todayKst, type Cycle } from './cycle'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Executor = typeof db | Tx

export type Settings = { payDay: number; cardCutoffDay: number; cardPayDay: number; hideAmounts: boolean }
export const DEFAULT_SETTINGS: Settings = { payDay: 5, cardCutoffDay: 24, cardPayDay: 5, hideAmounts: false }

export type MonthRow = typeof months.$inferSelect & { fixed: (typeof fixedExpenses.$inferSelect)[] }
export type CardBillRow = typeof cardBills.$inferSelect

export async function readSettings(q: Executor, userId: number): Promise<Settings | null> {
  const [row] = await q.select().from(settings).where(eq(settings.userId, userId))
  return row ? { payDay: row.payDay, cardCutoffDay: row.cardCutoffDay, cardPayDay: row.cardPayDay, hideAmounts: row.hideAmounts } : null
}

export async function readMonth(q: Executor, userId: number, ym: string, lock = false): Promise<MonthRow | null> {
  const base = q.select().from(months).where(and(eq(months.userId, userId), eq(months.ym, ym)))
  const [month] = lock ? await base.for('update') : await base
  if (!month) return null
  const fixed = await q.select().from(fixedExpenses).where(eq(fixedExpenses.monthId, month.id)).orderBy(asc(fixedExpenses.sort))
  return { ...month, fixed }
}

/** from ~ to (포함) 사이에 출금일이 있는 대금, 출금일 순 */
export async function readBills(q: Executor, userId: number, from: string, to: string): Promise<CardBillRow[]> {
  return q
    .select()
    .from(cardBills)
    .where(and(eq(cardBills.userId, userId), gte(cardBills.dueDate, from), lte(cardBills.dueDate, to)))
    .orderBy(asc(cardBills.dueDate))
}

export const toCardBill = (b: CardBillRow): CardBill => ({
  dueDate: b.dueDate,
  amount: b.amount,
  paidAmount: b.paidAmount,
  includesCardFixed: b.includesCardFixed,
})

/** 준비금 한 건 + 그 구매에서 다음 달로 미룬 금액 (= 가격 − 준비금) */
export type ReserveRow = Reserve & { deferred: number }

export type Ledger = {
  settings: Settings
  cycle: Cycle
  next: Cycle
  month: MonthRow
  /** 이번 주기·다음 주기 대금 (출금일 순) */
  bills: CardBillRow[]
  cashflow: Cashflow
  budget: Budget
  /** 이번 주기에 "산다"로 기록한 금액 합 (쇼핑 예산에서 빠지는 금액. 출금 뒤 환불한 것도 포함) */
  boughtTotal: number
  /** 이번 주기에 "산다"로 기록하고 환불·취소하지 않은 금액 합 (기록 화면의 "산 돈"과 같다) */
  boughtKept: number
  /** 이번 주기에 "안 산다"로 기록한 금액 합 */
  heldTotal: number
  /** 이번·다음 주기 대금에 들어갈 카드 결제 준비금 (앱에서 산 것, 출금일 기준) */
  reserves: ReserveRow[]
}

/**
 * 소비·준비금으로 계속 치는 기록: 취소 안 했거나, 원래 대금 출금 뒤에 환불한 것.
 * (출금 뒤 환불은 원래 대금을 준비금으로 이미 냈으므로 그대로 두고, 환불은 다음 청구에서 빠진다)
 */
const stillConsumed = or(isNull(decisions.canceledAt), not(decisions.refundBeforeBilling))

/** 카드 구매. null 은 0005 이전 기록 (그때는 전부 카드였다) */
const paidByCard = or(isNull(decisions.paymentMethod), eq(decisions.paymentMethod, 'card'))

/** 기록 한 건이 이번 주기 쇼핑 예산으로 묶은 금액. 계좌 구매는 전액, 카드 구매는 reserve_amount (null 이면 전액) */
export function reservedOf(d: { price: number; paymentMethod: 'account' | 'card' | null; reserveAmount: number | null }): number {
  if (d.paymentMethod === 'account') return d.price
  return Math.min(d.reserveAmount ?? d.price, d.price)
}

/** 준비금 계산에 볼 과거 구매 범위. 사용일 → 출금일은 길어야 두 달 남짓이다 */
const RESERVE_LOOKBACK_DAYS = 100

/**
 * today 가 속한 주기의 장부. 이번 주기 설정(months)이 없으면 null.
 * lock 이면 months 행을 FOR UPDATE 로 잡아 같은 달의 choose 를 직렬화한다.
 */
export async function readLedger(q: Executor, userId: number, today: string, lock = false): Promise<Ledger | null> {
  const s = (await readSettings(q, userId)) ?? DEFAULT_SETTINGS
  const cycle = cycleFor(today, s.payDay)
  const month = await readMonth(q, userId, cycle.ym, lock)
  if (!month) return null
  return computeLedger(q, userId, s, cycle, month)
}

/** 저장해 둔 주기 기간 (지난 주기는 지금 월급일로 다시 계산하지 않는다) */
export function storedCycle(month: Pick<MonthRow, 'ym' | 'cycleStart' | 'cycleEnd'>): Cycle {
  return { ym: month.ym, start: month.cycleStart, end: month.cycleEnd, days: daysBetween(month.cycleStart, month.cycleEnd) + 1 }
}

/** 지난 주기(또는 아무 주기) 장부. 그 주기를 저장할 때의 기간으로 계산한다. 없으면 null. */
export async function readLedgerByYm(q: Executor, userId: number, ym: string): Promise<Ledger | null> {
  const s = (await readSettings(q, userId)) ?? DEFAULT_SETTINGS
  const month = await readMonth(q, userId, ym)
  if (!month) return null
  return computeLedger(q, userId, s, storedCycle(month), month)
}

async function computeLedger(q: Executor, userId: number, s: Settings, cycle: Cycle, month: MonthRow): Promise<Ledger> {
  const next = nextCycle(cycle, s.payDay)
  const bills = await readBills(q, userId, cycle.start, next.end)
  const chosen = await q
    .select({
      price: decisions.price,
      choice: decisions.choice,
      canceledAt: decisions.canceledAt,
      paymentMethod: decisions.paymentMethod,
      reserveAmount: decisions.reserveAmount,
    })
    .from(decisions)
    .where(and(eq(decisions.userId, userId), eq(decisions.monthId, month.id), stillConsumed))
  let boughtTotal = 0
  let boughtKept = 0
  let heldTotal = 0
  let deferred = 0
  for (const d of chosen) {
    if (d.choice === 'bought') {
      boughtTotal += d.price
      deferred += d.price - reservedOf(d)
      if (!d.canceledAt) boughtKept += d.price
    } else heldTotal += d.price
  }

  const reserves = await readReserves(q, userId, s, cycle, next)

  const cashflow = computeCashflow({
    salary: month.salary,
    fixed: month.fixed.map((f) => ({ amount: f.amount, method: f.paymentMethod })),
    bills: bills.map(toCardBill),
    cycle,
    nextCycle: next,
    reserves,
  })
  const budget = computeBudget({
    cash: cashflow.cash,
    livingTarget: month.livingTarget,
    emergencyAmount: month.emergencyAmount,
    spentShopping: boughtTotal,
    deferred,
    cycleDays: cycle.days,
  })
  return { settings: s, cycle, next, month, bills, cashflow, budget, boughtTotal, boughtKept, heldTotal, reserves }
}

/**
 * 카드 결제 준비금: 지난 주기에 산 것까지 포함해, 이번·다음 주기에 출금될 카드 구매만 고른다.
 * 볼 범위는 그 주기 시작일 기준으로 잡는다 (지난 주기를 볼 때도 같은 결과가 나오게).
 * 출금일은 구매 때 저장한 값(due_date)을 쓰고, 없으면(0005 이전) 지금 설정으로 계산한다.
 */
export async function readReserves(
  q: Executor,
  userId: number,
  s: Pick<Settings, 'cardCutoffDay' | 'cardPayDay'>,
  cycle: Cycle,
  next: Cycle,
): Promise<ReserveRow[]> {
  const since = new Date(Date.parse(`${cycle.start}T00:00:00+09:00`) - RESERVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const bought = await q
    .select({
      price: decisions.price,
      decidedAt: decisions.decidedAt,
      paymentMethod: decisions.paymentMethod,
      reserveAmount: decisions.reserveAmount,
      dueDate: decisions.dueDate,
    })
    .from(decisions)
    .where(and(eq(decisions.userId, userId), eq(decisions.choice, 'bought'), gte(decisions.decidedAt, since), stillConsumed, paidByCard))
  return bought
    .map((d) => {
      const amount = reservedOf(d)
      return { dueDate: d.dueDate ?? statementDueDate(todayKst(d.decidedAt), s.cardCutoffDay, s.cardPayDay), amount, deferred: d.price - amount }
    })
    .filter((r) => inCycle(r.dueDate, cycle) || inCycle(r.dueDate, next))
}
