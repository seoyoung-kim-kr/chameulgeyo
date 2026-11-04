import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { decisions, months, settings } from '@/db/schema'
import { cycleFor, daysBetween, isCutoffDay, nextCycle, prevYm, todayKst, type Cycle } from './cycle'
import type { Reserve } from './cashflow'
import { DEFAULT_SETTINGS, readBills, readLedger, readMonth, readReserves, readSettings, type CardBillRow, type Ledger, type MonthRow, type Settings } from './ledger'
import { requireSession } from './session'

// 화면용 조회 함수. 전부 첫 줄에서 requireSession() 을 부른다 (proxy 는 낙관적 검사일 뿐).
// cookies() 를 먼저 읽으므로 호출하는 컴포넌트는 <Suspense> 안에 있어야 한다.

export type { CardBillRow, MonthRow, Settings }

async function loadSettings(): Promise<Settings> {
  const row = await readSettings(db)
  if (row) return row
  await db.insert(settings).values({ id: 1, ...DEFAULT_SETTINGS }).onConflictDoNothing()
  return DEFAULT_SETTINGS
}

/** 설정 행이 없으면 기본값(월급일 5, 확정일 24, 출금일 5)으로 만든다. */
export async function getSettings(): Promise<Settings> {
  await requireSession()
  return loadSettings()
}

export async function getCurrentCycle(): Promise<{ settings: Settings; cycle: Cycle; next: Cycle; today: string }> {
  await requireSession()
  const s = await loadSettings()
  const today = todayKst()
  const cycle = cycleFor(today, s.payDay)
  return { settings: s, cycle, next: nextCycle(cycle, s.payDay), today }
}

export async function getMonthByYm(ym: string): Promise<MonthRow | null> {
  await requireSession()
  return readMonth(db, ym)
}

/**
 * /setup 기본값. 이번 주기 설정이 없으면 직전 주기를 함께 돌려준다 (복사용).
 * 카드 대금은 출금일 기준이라 주기와 상관없이 그대로 읽는다: 지난 주기에 적어 둔 "다음 대금"이 이번 주기 대금이 된다.
 */
export async function getSetupDefaults(): Promise<{
  settings: Settings
  cycle: Cycle
  next: Cycle
  today: string
  current: MonthRow | null
  previous: MonthRow | null
  thisBill: CardBillRow | null
  nextBill: CardBillRow | null
  reserves: Reserve[]
}> {
  const { settings: s, cycle, next, today } = await getCurrentCycle()
  const current = await readMonth(db, cycle.ym)
  const previous = current ? null : await readMonth(db, prevYm(cycle.ym))
  const [thisBill = null] = await readBills(db, cycle.start, cycle.end)
  const [nextBill = null] = await readBills(db, next.start, next.end)
  const reserves = await readReserves(db, s, cycle, next)
  return { settings: s, cycle, next, today, current, previous, thisBill, nextBill, reserves }
}

export type HomeData = Ledger & {
  today: string
  isCutoff: boolean
  /** 다음 대금을 카드 앱 숫자로 마지막에 옮겨 적은 날로부터 지난 일수 (없으면 null) */
  nextBillStaleDays: number | null
}

/**
 * 홈·판정 화면 데이터. 이번 주기 설정이 없으면 null.
 * redirect('/setup') 하지 않는 이유: 그 리다이렉트가 Activity 로 보존된 홈 화면에 남아 있다가,
 * 설정을 저장하고 홈으로 돌아올 때 되살아나 다시 /setup 으로 튕긴다(2026-11-05 실측).
 * 호출하는 화면이 null 일 때 무엇을 보여줄지 정한다.
 */
export async function getHomeData(): Promise<HomeData | null> {
  await requireSession()
  const today = todayKst()
  const ledger = await readLedger(db, today)
  if (!ledger) return null
  const nextBill = ledger.bills.find((b) => b.dueDate >= ledger.next.start)
  return {
    ...ledger,
    today,
    isCutoff: isCutoffDay(today, ledger.settings.cardCutoffDay),
    nextBillStaleDays: nextBill ? Math.max(daysBetween(todayKst(nextBill.updatedAt), today), 0) : null,
  }
}

/** /card 화면: 이번 주기·다음 주기 대금과 카드 고정지출 합 */
export async function getCardBills(): Promise<{
  cycle: Cycle
  next: Cycle
  settings: Settings
  thisBill: CardBillRow | null
  nextBill: CardBillRow | null
  cardFixed: number
} | null> {
  await requireSession()
  const ledger = await readLedger(db, todayKst())
  if (!ledger) return null
  return {
    cycle: ledger.cycle,
    next: ledger.next,
    settings: ledger.settings,
    thisBill: ledger.bills.find((b) => b.dueDate <= ledger.cycle.end) ?? null,
    nextBill: ledger.bills.find((b) => b.dueDate >= ledger.next.start) ?? null,
    cardFixed: ledger.cashflow.fixed.card,
  }
}

export type DecisionRow = typeof decisions.$inferSelect

export type History = {
  ym: string
  /** 아낀 돈(안 산 금액) 합계 (held 전체) */
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
