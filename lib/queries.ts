import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { fixedExpenses, months, settings } from '@/db/schema'
import { cycleFor, prevYm, todayKst, type Cycle } from './cycle'
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
