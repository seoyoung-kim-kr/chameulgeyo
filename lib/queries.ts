import 'server-only'
import { and, asc, desc, eq, sum } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { decisions, fixedExpenses, months, settings } from '@/db/schema'
import { computeBudget, type Budget } from './budget'
import { cycleFor, daysBetween, isCutoffDay, prevYm, todayKst, type Cycle } from './cycle'
import { requireSession } from './session'

// 화면용 조회 함수. 전부 첫 줄에서 requireSession() 을 부른다 (proxy 는 낙관적 검사일 뿐).
// cookies() 를 먼저 읽으므로 호출하는 컴포넌트는 <Suspense> 안에 있어야 한다.

export type Settings = { payDay: number; cardCutoffDay: number }
export type MonthRow = typeof months.$inferSelect & { fixed: (typeof fixedExpenses.$inferSelect)[] }

const DEFAULT_SETTINGS: Settings = { payDay: 5, cardCutoffDay: 24 }

async function loadSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1))
  if (row) return { payDay: row.payDay, cardCutoffDay: row.cardCutoffDay }
  await db.insert(settings).values({ id: 1, ...DEFAULT_SETTINGS }).onConflictDoNothing()
  return DEFAULT_SETTINGS
}

async function loadMonth(ym: string): Promise<MonthRow | null> {
  const [month] = await db.select().from(months).where(eq(months.ym, ym))
  if (!month) return null
  const fixed = await db.select().from(fixedExpenses).where(eq(fixedExpenses.monthId, month.id)).orderBy(asc(fixedExpenses.sort))
  return { ...month, fixed }
}

/** 설정 행이 없으면 기본값(월급일 5, 확정일 24)으로 만든다. */
export async function getSettings(): Promise<Settings> {
  await requireSession()
  return loadSettings()
}

export async function getCurrentCycle(): Promise<{ settings: Settings; cycle: Cycle; today: string }> {
  await requireSession()
  const s = await loadSettings()
  const today = todayKst()
  return { settings: s, cycle: cycleFor(today, s.payDay), today }
}

export async function getMonthByYm(ym: string): Promise<MonthRow | null> {
  await requireSession()
  return loadMonth(ym)
}

/** /setup 기본값. 이번 주기 설정이 없으면 직전 주기를 함께 돌려준다 (복사용). */
export async function getSetupDefaults(): Promise<{
  settings: Settings
  cycle: Cycle
  today: string
  current: MonthRow | null
  previous: MonthRow | null
}> {
  const { settings: s, cycle, today } = await getCurrentCycle()
  const current = await loadMonth(cycle.ym)
  const previous = current ? null : await loadMonth(prevYm(cycle.ym))
  return { settings: s, cycle, today, current, previous }
}

export type HomeData = {
  cycle: Cycle
  today: string
  settings: Settings
  month: MonthRow
  budget: Budget
  /** 이번 주기에 참은 돈 합계 (held 전체, 판정 색 무관) */
  heldTotal: number
  isCutoff: boolean
  /** 카드값을 마지막으로 옮겨 적은 날로부터 지난 일수 (KST 날짜 기준) */
  cardStaleDays: number
}

/** 홈·판정 화면 데이터. 이번 주기 설정이 없으면 /setup 으로 보낸다. */
export async function getHomeData(): Promise<HomeData> {
  const { settings: s, cycle, today } = await getCurrentCycle()
  const month = await loadMonth(cycle.ym)
  if (!month) redirect('/setup')

  const [held] = await db
    .select({ total: sum(decisions.price) })
    .from(decisions)
    .where(and(eq(decisions.monthId, month.id), eq(decisions.choice, 'held')))

  const budget = computeBudget({
    salary: month.salary,
    fixedTotal: month.fixed.reduce((acc, f) => acc + f.amount, 0),
    cardBalance: month.cardBalance,
    livingTarget: month.livingTarget,
    emergencyAmount: month.emergencyAmount,
    cycleDays: cycle.days,
  })

  return {
    cycle,
    today,
    settings: s,
    month,
    budget,
    heldTotal: Number(held?.total ?? 0),
    isCutoff: isCutoffDay(today, s.cardCutoffDay),
    cardStaleDays: Math.max(daysBetween(todayKst(month.cardUpdatedAt), today), 0),
  }
}

export type DecisionRow = typeof decisions.$inferSelect

export type History = {
  ym: string
  /** 참은 돈 합계 (held 전체) */
  heldTotal: number
  /** 그래도 산 돈 합계 (bought 전체) */
  boughtTotal: number
  /** 최신순 */
  items: DecisionRow[]
}

const YM_RE = /^[0-9]{4}-(0[1-9]|1[0-2])$/

/**
 * 한 주기의 판정 기록. ym 이 없거나 형식이 틀리면 현재 주기.
 * 합계는 목록에서 계산해 "합계 = 목록 합" 이 항상 성립하게 한다.
 */
export async function getHistory(ym: string | undefined): Promise<History> {
  await requireSession()
  const target = ym && YM_RE.test(ym) ? ym : cycleFor(todayKst(), (await loadSettings()).payDay).ym

  const [month] = await db.select({ id: months.id }).from(months).where(eq(months.ym, target))
  const items = month
    ? await db.select().from(decisions).where(eq(decisions.monthId, month.id)).orderBy(desc(decisions.decidedAt))
    : []

  let heldTotal = 0
  let boughtTotal = 0
  for (const d of items) {
    if (d.choice === 'held') heldTotal += d.price
    else boughtTotal += d.price
  }
  return { ym: target, heldTotal, boughtTotal, items }
}

/** 설정이 저장된 주기 목록 (ym 내림차순) */
export async function listMonths(): Promise<string[]> {
  await requireSession()
  const rows = await db.select({ ym: months.ym }).from(months).orderBy(desc(months.ym))
  return rows.map((r) => r.ym)
}
