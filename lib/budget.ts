// 예산·판정 순수 함수. 클라이언트 미리보기와 서버 저장이 같은 함수를 쓴다.
// 금액은 모두 정수(원).

export const PRICE_MIN = 1
export const PRICE_MAX = 100_000_000

export type BudgetInput = {
  salary: number
  fixedTotal: number
  cardBalance: number
  livingTarget: number
  emergencyAmount: number
  cycleDays: number
}

export type Budget = {
  /** 다음 달 쓸 수 있는 돈 = 월급 − 고정지출 − 카드값 */
  available: number
  /** 쓸 수 있는 돈 − 생활비 목표 − 비상금. 음수일 수 있다. 판정은 이 값을 쓴다. */
  shoppingRaw: number
  /** 화면 표시용 쇼핑 가능액 (0 미만은 0) */
  shopping: number
  /** 쇼핑 예산이 음수 = 이번 달은 쇼핑 없음 */
  shoppingExhausted: boolean
  /** 지금 실제로 남은 생활비. 쇼핑 예산이 음수면 모자란 만큼 목표에서 이미 깎여 있다. */
  livingNow: number
  /** livingNow ÷ 주기 일수 (내림) */
  livingPerDay: number
}

export function computeBudget(i: BudgetInput): Budget {
  const available = i.salary - i.fixedTotal - i.cardBalance
  const shoppingRaw = available - i.livingTarget - i.emergencyAmount
  const livingNow = i.livingTarget + Math.min(shoppingRaw, 0)
  return {
    available,
    shoppingRaw,
    shopping: Math.max(shoppingRaw, 0),
    shoppingExhausted: shoppingRaw < 0,
    livingNow,
    livingPerDay: Math.floor(livingNow / i.cycleDays),
  }
}

export type Verdict = {
  verdict: 'red' | 'green'
  /** 쇼핑 가능액(표시값)을 넘긴 금액. 초록이면 0 */
  overAmount: number
  /** 사고 나면 남는 생활비 */
  livingAfter: number
  livingAfterPerDay: number
  /** 사고 나면 남는 쇼핑 가능액 (빨강이면 0) */
  shoppingAfter: number
  /** 사면 생활비가 마이너스가 된다 */
  livingExhausted: boolean
}

export type JudgeContext = { shoppingRaw: number; livingTarget: number; cycleDays: number }

export function judge(price: number, ctx: JudgeContext): Verdict {
  const shopping = Math.max(ctx.shoppingRaw, 0)
  const livingNow = ctx.livingTarget + Math.min(ctx.shoppingRaw, 0)

  if (price > shopping) {
    const overAmount = price - shopping
    const livingAfter = livingNow - overAmount
    return {
      verdict: 'red',
      overAmount,
      livingAfter,
      livingAfterPerDay: Math.floor(livingAfter / ctx.cycleDays),
      shoppingAfter: 0,
      livingExhausted: livingAfter < 0,
    }
  }

  return {
    verdict: 'green',
    overAmount: 0,
    livingAfter: livingNow,
    livingAfterPerDay: Math.floor(livingNow / ctx.cycleDays),
    shoppingAfter: shopping - price,
    livingExhausted: false,
  }
}

/** 판정 가능한 가격: PRICE_MIN 이상 PRICE_MAX 이하 정수 */
export function isValidPrice(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= PRICE_MIN && n <= PRICE_MAX
}
