// 예산·판정 순수 함수. 클라이언트 미리보기와 서버 저장이 같은 함수를 쓴다.
// 금액은 모두 정수(원).
//
// 원칙 (2026-11-06, docs/requests/2026-11-06-calculation-audit.md)
// - 쇼핑 예산·생활비·비상금은 이번 주기 현금을 나눈 것이다.
// - 산 금액은 결제수단과 상관없이 이번 주기 쇼핑 예산에서 빠진다. 넘으면 쇼핑 예산이 마이너스로 보인다.
// - 예산을 넘긴 금액은 두 갈래다:
//   · 현금(계좌)으로 샀으면 이번 주기 생활비가 그만큼 준다.
//   · 카드로 샀으면 다음 달 카드값으로 미룬다(deferred). 이번 주기 생활비는 그대로이고 다음 주기 현금이 준다 (lib/cashflow.ts 준비금).
// - 생활비를 0 밑으로 깎는 구매는 막는다 (이번 달이든 다음 달이든).

export const PRICE_MIN = 1
export const PRICE_MAX = 100_000_000

export type BudgetInput = {
  /** 이번 주기 현금 (lib/cashflow.ts computeCashflow 의 cash) */
  cash: number
  livingTarget: number
  emergencyAmount: number
  /** 이번 주기에 "산다"로 기록한 금액 합 (결제수단 무관). 쇼핑 예산에서만 빠지고 현금 계산에는 들어가지 않는다 */
  spentShopping: number
  /** 그중 카드로 다음 달에 미룬 금액 (카드 구매 가격 − 이번 주기 쇼핑 예산으로 묶은 준비금). 이번 주기 생활비를 깎지 않는다 */
  deferred?: number
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
  /** 카드로 다음 달에 미룬 금액 */
  deferred: number
  /** 지금 실제로 남은 생활비. 쇼핑 예산이 음수면 모자란 만큼(미룬 금액 제외) 목표에서 이미 깎여 있다. */
  livingNow: number
  /** livingNow ÷ 주기 일수 (내림) */
  livingPerDay: number
}

/** 생활비 = 목표 + (쇼핑 예산 중 카드로 미루지 않은 마이너스분) */
export function livingFrom(livingTarget: number, shoppingRaw: number, deferred: number): number {
  return livingTarget + Math.min(shoppingRaw + deferred, 0)
}

/**
 * 이번 주기 현금을 생활비·비상금·쇼핑으로 나눈다.
 */
export function computeBudget(i: BudgetInput): Budget {
  const available = i.cash
  const deferred = i.deferred ?? 0
  const shoppingRaw = available - i.livingTarget - i.emergencyAmount - i.spentShopping
  const livingNow = livingFrom(i.livingTarget, shoppingRaw, deferred)
  return {
    available,
    shoppingRaw,
    shopping: Math.max(shoppingRaw, 0),
    shoppingExhausted: shoppingRaw < 0,
    deferred,
    livingNow,
    livingPerDay: Math.floor(livingNow / i.cycleDays),
  }
}

export type Verdict = {
  verdict: 'red' | 'green'
  /** 쇼핑 가능액(표시값)을 넘긴 금액. 초록이면 0 */
  overAmount: number
  /** 카드로 사면 이번 주기 쇼핑 예산으로 묶는 금액 = 가격 − 넘긴 금액. 나머지(overAmount)는 다음 달로 미룬다 */
  reserve: number
  /** "생활비를 줄인다"(현금)로 사고 나면 남는 이번 주기 생활비 */
  livingAfter: number
  livingAfterPerDay: number
  /** 사고 나면 남는 쇼핑 가능액 (빨강이면 0) */
  shoppingAfter: number
  /** 현금으로 사면 이번 주기 생활비가 마이너스가 된다 → 그 선택을 막는다 */
  livingExhausted: boolean
  /** 다음 주기 예상 생활비 (사기 전). 다음 달 월급·고정지출·생활비 목표·비상금은 이번 달과 같다고 본다 */
  nextLivingNow: number
  /** 카드로 사서 넘긴 금액을 다음 달로 미루면 남는 다음 주기 생활비 */
  nextLivingAfter: number
  nextLivingAfterPerDay: number
  /** 카드로 사면 다음 주기 생활비가 마이너스가 된다 → 그 선택을 막는다 */
  nextLivingExhausted: boolean
}

export type JudgeContext = {
  shoppingRaw: number
  /** 카드로 미룬 금액 (computeBudget 의 deferred). 생활비 계산에 쓴다 */
  deferred: number
  livingTarget: number
  emergencyAmount: number
  cycleDays: number
  /** 다음 주기 예상 현금 (computeCashflow 의 nextCash) */
  nextCash: number
  nextCycleDays: number
}

export function judge(price: number, ctx: JudgeContext): Verdict {
  const shopping = Math.max(ctx.shoppingRaw, 0)
  const livingNow = livingFrom(ctx.livingTarget, ctx.shoppingRaw, ctx.deferred)
  // 다음 주기는 아직 산 게 없고 미룬 것도 없다고 보고, 이번 달 목표로 나눈다
  const nextShoppingRaw = ctx.nextCash - ctx.livingTarget - ctx.emergencyAmount
  const nextLivingNow = livingFrom(ctx.livingTarget, nextShoppingRaw, 0)

  if (price > shopping) {
    const overAmount = price - shopping
    const livingAfter = livingNow - overAmount
    const nextLivingAfter = livingFrom(ctx.livingTarget, nextShoppingRaw - overAmount, 0)
    return {
      verdict: 'red',
      overAmount,
      reserve: shopping,
      livingAfter,
      livingAfterPerDay: Math.floor(livingAfter / ctx.cycleDays),
      shoppingAfter: 0,
      livingExhausted: livingAfter < 0,
      nextLivingNow,
      nextLivingAfter,
      nextLivingAfterPerDay: Math.floor(nextLivingAfter / ctx.nextCycleDays),
      nextLivingExhausted: nextLivingAfter < 0,
    }
  }

  return {
    verdict: 'green',
    overAmount: 0,
    reserve: price,
    livingAfter: livingNow,
    livingAfterPerDay: Math.floor(livingNow / ctx.cycleDays),
    shoppingAfter: shopping - price,
    livingExhausted: false,
    nextLivingNow,
    nextLivingAfter: nextLivingNow,
    nextLivingAfterPerDay: Math.floor(nextLivingNow / ctx.nextCycleDays),
    nextLivingExhausted: false,
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
  const livingNow = livingFrom(ctx.livingTarget, ctx.shoppingRaw, ctx.deferred)
  return {
    ...judge(price, ctx),
    price,
    shopping,
    livingNow,
    livingPerDay: Math.floor(livingNow / ctx.cycleDays),
  }
}

export type PurchaseMethod = 'account' | 'card'

/**
 * 이 결제수단으로 살 수 있는지. 서버 저장과 버튼 활성이 같은 규칙을 쓴다.
 * - 현금: 이번 주기 생활비가 0 밑으로 내려가면 못 산다
 * - 카드: 다음 주기 생활비가 0 밑으로 내려가면 못 산다
 */
export function canBuy(v: Verdict, method: PurchaseMethod): boolean {
  return method === 'card' ? !v.nextLivingExhausted : !v.livingExhausted
}
