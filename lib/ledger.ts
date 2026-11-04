// 이번 급여 주기 장부를 DB 에서 읽어 계산한다. 세션 검사는 하지 않는다 (호출하는 쪽 책임):
// - lib/queries.ts (화면 조회, requireSession 후 호출)
// - lib/decisions.ts (판정·선택, 서버 액션 withSession 안에서 호출)
// 계산 자체는 lib/cashflow.ts · lib/budget.ts 의 순수 함수가 한다.
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { cardBills, decisions, fixedExpenses, months, settings } from '@/db/schema'
import { computeBudget, type Budget } from './budget'
import { computeCashflow, type CardBill, type Cashflow } from './cashflow'
import { cycleFor, nextCycle, type Cycle } from './cycle'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Executor = typeof db | Tx

export type Settings = { payDay: number; cardCutoffDay: number; cardPayDay: number }
export const DEFAULT_SETTINGS: Settings = { payDay: 5, cardCutoffDay: 24, cardPayDay: 5 }

export type MonthRow = typeof months.$inferSelect & { fixed: (typeof fixedExpenses.$inferSelect)[] }
export type CardBillRow = typeof cardBills.$inferSelect

export async function readSettings(q: Executor): Promise<Settings | null> {
  const [row] = await q.select().from(settings).where(eq(settings.id, 1))
  return row ? { payDay: row.payDay, cardCutoffDay: row.cardCutoffDay, cardPayDay: row.cardPayDay } : null
}

export async function readMonth(q: Executor, ym: string, lock = false): Promise<MonthRow | null> {
  const base = q.select().from(months).where(eq(months.ym, ym))
  const [month] = lock ? await base.for('update') : await base
  if (!month) return null
  const fixed = await q.select().from(fixedExpenses).where(eq(fixedExpenses.monthId, month.id)).orderBy(asc(fixedExpenses.sort))
  return { ...month, fixed }
}

/** from ~ to (포함) 사이에 출금일이 있는 대금, 출금일 순 */
export async function readBills(q: Executor, from: string, to: string): Promise<CardBillRow[]> {
  return q
    .select()
    .from(cardBills)
    .where(and(gte(cardBills.dueDate, from), lte(cardBills.dueDate, to)))
    .orderBy(asc(cardBills.dueDate))
}

export const toCardBill = (b: CardBillRow): CardBill => ({
  dueDate: b.dueDate,
  amount: b.amount,
  paidAmount: b.paidAmount,
  includesCardFixed: b.includesCardFixed,
})

export type Ledger = {
  settings: Settings
  cycle: Cycle
  next: Cycle
  month: MonthRow
  /** 이번 주기·다음 주기 대금 (출금일 순) */
  bills: CardBillRow[]
  cashflow: Cashflow
  budget: Budget
  /** 이번 주기에 "산다"로 기록한 금액 합 */
  boughtTotal: number
  /** 이번 주기에 "안 산다"로 기록한 금액 합 */
  heldTotal: number
}

/**
 * today 가 속한 주기의 장부. 이번 주기 설정(months)이 없으면 null.
 * lock 이면 months 행을 FOR UPDATE 로 잡아 같은 달의 choose 를 직렬화한다.
 */
export async function readLedger(q: Executor, today: string, lock = false): Promise<Ledger | null> {
  const s = (await readSettings(q)) ?? DEFAULT_SETTINGS
  const cycle = cycleFor(today, s.payDay)
  const next = nextCycle(cycle, s.payDay)
  const month = await readMonth(q, cycle.ym, lock)
  if (!month) return null

  const bills = await readBills(q, cycle.start, next.end)
  const chosen = await q
    .select({ price: decisions.price, choice: decisions.choice })
    .from(decisions)
    .where(eq(decisions.monthId, month.id))
  let boughtTotal = 0
  let heldTotal = 0
  for (const d of chosen) {
    if (d.choice === 'bought') boughtTotal += d.price
    else heldTotal += d.price
  }

  const cashflow = computeCashflow({
    salary: month.salary,
    fixed: month.fixed.map((f) => ({ amount: f.amount, method: f.paymentMethod })),
    bills: bills.map(toCardBill),
    cycle,
    nextCycle: next,
  })
  const budget = computeBudget({
    cash: cashflow.cash,
    livingTarget: month.livingTarget,
    emergencyAmount: month.emergencyAmount,
    spentShopping: boughtTotal,
    cycleDays: cycle.days,
  })
  return { settings: s, cycle, next, month, bills, cashflow, budget, boughtTotal, heldTotal }
}
