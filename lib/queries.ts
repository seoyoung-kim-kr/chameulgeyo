import 'server-only'
import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { decisions, months, settings } from '@/db/schema'
import { cycleFor, daysBetween, isCutoffDay, nextCycle, prevYm, todayKst, type Cycle } from './cycle'
import type { Reserve } from './cashflow'
import {
  DEFAULT_SETTINGS,
  readBills,
  readLedger,
  readLedgerByYm,
  readMonth,
  readReserves,
  readSettings,
  type CardBillRow,
  type Ledger,
  type MonthRow,
  type Settings,
} from './ledger'
import { requireUserId } from './session'

// 화면용 조회 함수. 전부 첫 줄에서 requireUserId() 를 부르고 그 사용자 행만 읽는다 (proxy 는 낙관적 검사일 뿐).
// cookies() 를 먼저 읽으므로 호출하는 컴포넌트는 <Suspense> 안에 있어야 한다.

export type { CardBillRow, MonthRow, Settings }

/** 설정 행이 없으면 기본값(월급일 5, 확정일 24, 출금일 5)으로 만든다. */
async function loadSettings(userId: number): Promise<Settings> {
  const row = await readSettings(db, userId)
  if (row) return row
  await db.insert(settings).values({ userId, ...DEFAULT_SETTINGS }).onConflictDoNothing()
  return DEFAULT_SETTINGS
}

async function currentCycle(userId: number): Promise<{ settings: Settings; cycle: Cycle; next: Cycle; today: string }> {
  const s = await loadSettings(userId)
  const today = todayKst()
  const cycle = cycleFor(today, s.payDay)
  return { settings: s, cycle, next: nextCycle(cycle, s.payDay), today }
}

/** 이 사용자가 저장한 주기 중 ym 바로 앞 주기 (없으면 null) */
async function previousYm(userId: number, ym: string): Promise<string | null> {
  const [row] = await db
    .select({ ym: months.ym })
    .from(months)
    .where(and(eq(months.userId, userId), lt(months.ym, ym)))
    .orderBy(desc(months.ym))
    .limit(1)
  return row?.ym ?? null
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
  const userId = await requireUserId()
  const { settings: s, cycle, next, today } = await currentCycle(userId)
  const current = await readMonth(db, userId, cycle.ym)
  const previous = current ? null : await readMonth(db, userId, prevYm(cycle.ym))
  const [thisBill = null] = await readBills(db, userId, cycle.start, cycle.end)
  const [nextBill = null] = await readBills(db, userId, next.start, next.end)
  const reserves = await readReserves(db, userId, s, cycle, next)
  return { settings: s, cycle, next, today, current, previous, thisBill, nextBill, reserves }
}

export type HomeData = Ledger & {
  today: string
  isCutoff: boolean
  /** 다음 대금을 카드 앱 숫자로 마지막에 옮겨 적은 날로부터 지난 일수 (없으면 null) */
  nextBillStaleDays: number | null
  /** 저장한 지난 주기 중 가장 최근 것 (홈의 "지난 달" 링크, 없으면 null) */
  previousYm: string | null
}

/**
 * 홈·판정 화면 데이터. 이번 주기 설정이 없으면 null.
 * redirect('/setup') 하지 않는 이유: 그 리다이렉트가 Activity 로 보존된 홈 화면에 남아 있다가,
 * 설정을 저장하고 홈으로 돌아올 때 되살아나 다시 /setup 으로 튕긴다(2026-11-05 실측).
 * 호출하는 화면이 null 일 때 무엇을 보여줄지 정한다.
 */
export async function getHomeData(): Promise<HomeData | null> {
  const userId = await requireUserId()
  const today = todayKst()
  const ledger = await readLedger(db, userId, today)
  if (!ledger) return null
  const nextBill = ledger.bills.find((b) => b.dueDate >= ledger.next.start)
  return {
    ...ledger,
    today,
    isCutoff: isCutoffDay(today, ledger.settings.cardCutoffDay),
    nextBillStaleDays: nextBill ? Math.max(daysBetween(todayKst(nextBill.updatedAt), today), 0) : null,
    previousYm: await previousYm(userId, ledger.cycle.ym),
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
  const userId = await requireUserId()
  const ledger = await readLedger(db, userId, todayKst())
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
  /** 그래도 산 돈 합계 (bought 중 환불·취소하지 않은 것) */
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
  const userId = await requireUserId()
  const target = ym && YM_RE.test(ym) ? ym : cycleFor(todayKst(), (await loadSettings(userId)).payDay).ym

  const [month] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.ym, target)))
  const items = month
    ? await db
        .select()
        .from(decisions)
        .where(and(eq(decisions.userId, userId), eq(decisions.monthId, month.id)))
        .orderBy(desc(decisions.decidedAt))
    : []

  let heldTotal = 0
  let boughtTotal = 0
  for (const d of items) {
    if (d.choice === 'held') heldTotal += d.price
    else if (!d.canceledAt) boughtTotal += d.price
  }
  return { ym: target, heldTotal, boughtTotal, items }
}

/** 설정이 저장된 주기 목록 (ym 내림차순) */
export async function listMonths(): Promise<string[]> {
  const userId = await requireUserId()
  return listYms(userId)
}

async function listYms(userId: number): Promise<string[]> {
  const rows = await db.select({ ym: months.ym }).from(months).where(eq(months.userId, userId)).orderBy(desc(months.ym))
  return rows.map((r) => r.ym)
}

export type PastCycle = Ledger & {
  /** 이번 주기(오늘이 속한 주기) ym. 이동 줄에서 "이번 달"로 보낼지 정한다 */
  currentYm: string
  /** 저장한 주기 중 바로 앞·뒤 (없으면 null) */
  prevYm: string | null
  nextYm: string | null
}

/**
 * 지난 주기 화면 (/cycle/[ym]). 그 주기를 저장할 때의 기간으로 지금 DB 를 다시 계산한다
 * (그 당시 화면의 사진이 아니다: 나중에 고친 카드값·환불이 반영된다). 없는 주기면 null.
 */
export async function getPastCycle(ym: string): Promise<PastCycle | null> {
  const userId = await requireUserId()
  if (!YM_RE.test(ym)) return null
  const ledger = await readLedgerByYm(db, userId, ym)
  if (!ledger) return null
  const [{ cycle: current }, yms] = await Promise.all([currentCycle(userId), listYms(userId)])
  // yms 는 내림차순
  const i = yms.indexOf(ym)
  return { ...ledger, currentYm: current.ym, prevYm: yms[i + 1] ?? null, nextYm: i > 0 ? yms[i - 1] : null }
}
