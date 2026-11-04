// 예산·판정 순수 함수. 클라이언트 미리보기와 서버 저장이 같은 함수를 쓴다.
// 금액은 모두 정수(원).

export const PRICE_MIN = 1
export const PRICE_MAX = 100_000_000

export type BudgetInput = {
  /** 이번 주기 현금 (lib/cashflow.ts computeCashflow 의 cash) */
  cash: number
  livingTarget: number
  emergencyAmount: number
  /** 이번 주기에 "산다"로 기록한 금액 합. 소비 예산(쇼핑)에서만 빠지고 현금 계산에는 들어가지 않는다 */
  spentShopping: number
  cycleDays: number
}

export type Budget = {
  /** 이번 주기에 쓸 수 있는 돈 = 이번 주기 현금 */
  available: number
  /** 쓸 수 있는 돈 − 생활비 목표 − 비상금 − 이번 주기에 산 금액. 음수일 수 있다. 판정은 이 값을 쓴다. */
  shoppingRaw: number
  /** 화면 표시용 쇼핑 예산 (0 미만은 0) */
  shopping: number
  /** 쇼핑 예산이 음수 = 이번 달은 쇼핑 없음 */
  shoppingExhausted: boolean
  /** 지금 실제로 남은 생활비. 쇼핑 예산이 음수면 모자란 만큼 목표에서 이미 깎여 있다. */
  livingNow: number
  /** livingNow ÷ 주기 일수 (내림) */
  livingPerDay: number
}

/**
 * 이번 주기 현금을 생활비·비상금·쇼핑으로 나눈다.
 * 카드로 산 것은 쇼핑 예산(소비)에서 빠지고, 현금은 그 대금이 출금되는 주기에 빠진다 (lib/cashflow.ts).
 */
export function computeBudget(i: BudgetInput): Budget {
  const available = i.cash
  const shoppingRaw = available - i.livingTarget - i.emergencyAmount - i.spentShopping
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

/** 판정 화면에 필요한 값 전부. 클라이언트 미리보기와 서버 decide 가 같은 함수로 만든다. */
export type DecideResult = Verdict & {
  price: number
  /** 판정 시점 쇼핑 가능액 (표시값, 0 이상) */
  shopping: number
  /** 사기 전 실제 남은 생활비 (쇼핑 예산이 음수면 목표보다 적다) */
  livingNow: number
  /** 사기 전 하루 생활비 */
  livingPerDay: number
}

export function decisionFor(price: number, ctx: JudgeContext): DecideResult {
  const shopping = Math.max(ctx.shoppingRaw, 0)
  const livingNow = ctx.livingTarget + Math.min(ctx.shoppingRaw, 0)
  return {
    ...judge(price, ctx),
    price,
    shopping,
    livingNow,
    livingPerDay: Math.floor(livingNow / ctx.cycleDays),
  }
}
