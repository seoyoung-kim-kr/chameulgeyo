// 예산 주기(월급일 ~ 다음 월급일 전날) 날짜 계산.
// 날짜는 항상 KST 기준 'YYYY-MM-DD' 문자열로만 주고받는다. 이 파일 밖에서 new Date() 로 날짜를 계산하지 않는다.

export type Cycle = {
  /** 주기 시작일이 속한 달 'YYYY-MM' */
  ym: string
  /** 'YYYY-MM-DD' (포함) */
  start: string
  /** 'YYYY-MM-DD' (포함) */
  end: string
  days: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

function parseYm(ym: string): { y: number; m: number } {
  const [y, m] = ym.split('-').map(Number)
  return { y, m }
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d }
}

function toYm(y: number, m: number): string {
  // m 은 1~12 를 벗어날 수 있다 (0 → 전년 12월, 13 → 다음 해 1월)
  const t = new Date(Date.UTC(y, m - 1, 1))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`
}

/** 'YYYY-MM-DD' → UTC 자정 epoch ms. 날짜끼리 빼기·더하기에만 쓴다. */
function toEpoch(date: string): number {
  const { y, m, d } = parseDate(date)
  return Date.UTC(y, m - 1, d)
}

function fromEpoch(ms: number): string {
  const t = new Date(ms)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

function addDays(date: string, n: number): string {
  return fromEpoch(toEpoch(date) + n * DAY_MS)
}

/** 오늘 날짜 (KST). 서버는 UTC 라서 +9시간 한 시각의 UTC 성분을 읽는다. */
export function todayKst(now: Date = new Date()): string {
  return fromEpoch(now.getTime() + KST_OFFSET_MS)
}

export function daysInMonth(ym: string): number {
  const { y, m } = parseYm(ym)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 그 달에 없는 날(31일 등)은 말일로 당긴다. */
export function clampDay(ym: string, day: number): number {
  return Math.min(day, daysInMonth(ym))
}

function payDate(ym: string, payDay: number): string {
  return `${ym}-${pad(clampDay(ym, payDay))}`
}

/** date 가 속한 예산 주기. 월급일 당일부터 새 주기다. */
export function cycleFor(date: string, payDay: number): Cycle {
  const { y, m } = parseDate(date)
  const thisYm = toYm(y, m)
  const startYm = payDate(thisYm, payDay) <= date ? thisYm : toYm(y, m - 1)
  const start = payDate(startYm, payDay)
  const { y: sy, m: sm } = parseYm(startYm)
  const end = addDays(payDate(toYm(sy, sm + 1), payDay), -1)
  return { ym: startYm, start, end, days: (toEpoch(end) - toEpoch(start)) / DAY_MS + 1 }
}

export function nextCycle(c: Cycle, payDay: number): Cycle {
  return cycleFor(addDays(c.end, 1), payDay)
}

export function prevYm(ym: string): string {
  const { y, m } = parseYm(ym)
  return toYm(y, m - 1)
}

/** 카드 확정일인지. 그 달에 없는 날이면 말일이 확정일이다. */
export function isCutoffDay(date: string, cutoffDay: number): boolean {
  const { y, m, d } = parseDate(date)
  return d === clampDay(toYm(y, m), cutoffDay)
}

/** 주기 끝까지 남은 날 수. 오늘과 마지막 날을 모두 포함한다. */
export function daysLeft(date: string, c: Cycle): number {
  return (toEpoch(c.end) - toEpoch(date)) / DAY_MS + 1
}

/** 두 날짜('YYYY-MM-DD') 사이 일수. to 가 from 보다 앞이면 음수. */
export function daysBetween(from: string, to: string): number {
  return (toEpoch(to) - toEpoch(from)) / DAY_MS
}

/** 시각의 KST 'HH:mm'. 갱신 시각 표시용. */
export function timeKst(now: Date): string {
  const t = new Date(now.getTime() + KST_OFFSET_MS)
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`
}

/** 'YYYY-MM-DD' → 'M/D' */
export function shortDate(date: string): string {
  const { m, d } = parseDate(date)
  return `${m}/${d}`
}

/** 날짜가 주기 안(시작·끝 포함)인지 */
export function inCycle(date: string, c: Cycle): boolean {
  return date >= c.start && date <= c.end
}

/**
 * 주기 안에서 카드 대금이 빠지는 날 (기본값 제안용). 주기가 걸친 두 달에서 카드 출금일(말일 클램프)을 찾는다.
 * 주기 안에 해당 날이 없으면(예: 1/31~2/27 주기에 출금일 30일) 주기 시작일.
 */
export function cardDueDate(c: Cycle, cardPayDay: number): string {
  const { y, m } = parseDate(c.start)
  for (const ym of [toYm(y, m), toYm(y, m + 1)]) {
    const date = `${ym}-${pad(clampDay(ym, cardPayDay))}`
    if (inCycle(date, c)) return date
  }
  return c.start
}

/**
 * 카드 사용일 → 그 사용분이 출금되는 날.
 * 확정일(cutoffDay)까지 쓴 것이 한 청구서로 묶이고, 그 확정일 다음에 오는 첫 출금일(cardPayDay)에 빠진다.
 * 예: 확정일 24·출금일 5 → 11/10 사용은 12/5, 11/26 사용은 1/5 출금.
 */
export function statementDueDate(date: string, cutoffDay: number, cardPayDay: number): string {
  const { y, m, d } = parseDate(date)
  const ym = toYm(y, m)
  const endYm = d <= clampDay(ym, cutoffDay) ? ym : toYm(y, m + 1)
  const end = `${endYm}-${pad(clampDay(endYm, cutoffDay))}`
  const sameMonth = `${endYm}-${pad(clampDay(endYm, cardPayDay))}`
  if (sameMonth > end) return sameMonth
  const { y: ey, m: em } = parseYm(endYm)
  const nextYm = toYm(ey, em + 1)
  return `${nextYm}-${pad(clampDay(nextYm, cardPayDay))}`
}

export type RefundPlan = {
  /** 구매가 원래 들어간 대금의 출금일 */
  originalDue: string
  /** 환불액을 빼는 대금의 출금일 */
  refundDue: string
  /**
   * true: 원래 대금이 아직 출금 전 → 그 대금에서 빼고, 구매가 없던 것처럼 되돌린다 (쇼핑 예산·준비금 원복)
   * false: 원래 대금은 이미 출금됨(준비금으로 냄) → 환불은 오늘 기준 다음 청구에서 빠지는 돈으로 처리
   */
  beforeBilling: boolean
}

/**
 * 카드 구매 환불·취소를 어느 대금에 반영할지. 출금일 당일 취소는 이미 출금된 것으로 본다.
 * storedDue: 구매 때 저장해 둔 출금일. 있으면 그대로 쓴다 (그 뒤 설정을 바꿨어도 대금은 안 움직인다).
 */
export function refundPlan(purchaseDate: string, today: string, cutoffDay: number, cardPayDay: number, storedDue?: string | null): RefundPlan {
  const originalDue = storedDue ?? statementDueDate(purchaseDate, cutoffDay, cardPayDay)
  const beforeBilling = originalDue > today
  return { originalDue, refundDue: beforeBilling ? originalDue : statementDueDate(today, cutoffDay, cardPayDay), beforeBilling }
}
