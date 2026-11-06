import { describe, it, expect } from 'vitest'
import { canBuy, computeBudget, decisionFor, isValidPrice, judge } from './budget'

// 기획서 UI 시안 숫자: 월급 2,800,000 − 고정 1,350,000 − 카드 912,000 = 이번 주기 현금 538,000
const base = { cash: 538_000, livingTarget: 360_000, emergencyAmount: 30_000, spentShopping: 0, cycleDays: 30 }

describe('computeBudget', () => {
  it('시안 숫자', () =>
    expect(computeBudget(base)).toEqual({
      available: 538_000,
      shoppingRaw: 148_000,
      shopping: 148_000,
      shoppingExhausted: false,
      deferred: 0,
      livingNow: 360_000,
      livingPerDay: 12_000,
    }))

  it('쇼핑 예산 음수면 0 + exhausted, 모자란 만큼 생활비가 이미 깎여 있다', () => {
    const b = computeBudget({ ...base, cash: 250_000 })
    expect(b).toMatchObject({ available: 250_000, shoppingRaw: -140_000, shopping: 0, shoppingExhausted: true })
    // 250,000 − 비상금 30,000 = 실제로 남은 생활비 220,000
    expect(b.livingNow).toBe(220_000)
    expect(b.livingPerDay).toBe(7_333)
  })

  it('쇼핑 예산이 딱 0 이면 exhausted 아님', () => {
    const b = computeBudget({ ...base, cash: 390_000 })
    expect(b).toMatchObject({ shoppingRaw: 0, shopping: 0, shoppingExhausted: false, livingNow: 360_000 })
  })

  it('하루 환산은 내림', () => expect(computeBudget({ ...base, livingTarget: 319_000 }).livingPerDay).toBe(10_633))

  it('이번 주기에 산 금액은 쇼핑 예산에서만 한 번 빠지고, 쓸 수 있는 돈(현금)은 그대로', () => {
    const b = computeBudget({ ...base, spentShopping: 100_000 })
    expect(b).toMatchObject({ available: 538_000, shoppingRaw: 48_000, shopping: 48_000 })
  })

  it('산 금액이 쇼핑 예산을 넘으면 넘친 만큼 생활비가 깎인다', () =>
    expect(computeBudget({ ...base, spentShopping: 189_000 })).toMatchObject({ shoppingRaw: -41_000, shoppingExhausted: true, livingNow: 319_000 }))

  it('넘친 금액을 카드로 미뤘으면 쇼핑 예산은 마이너스로 보이고 생활비는 그대로', () =>
    expect(computeBudget({ ...base, spentShopping: 189_000, deferred: 41_000 })).toMatchObject({
      shoppingRaw: -41_000,
      shoppingExhausted: true,
      deferred: 41_000,
      livingNow: 360_000,
    }))

  it('일부만 미뤘으면 나머지만 생활비에서 (카드 구매 뒤 현금으로 또 산 경우)', () =>
    expect(computeBudget({ ...base, spentShopping: 200_000, deferred: 41_000 })).toMatchObject({ shoppingRaw: -52_000, livingNow: 349_000 }))
})

// 다음 달도 이번 달과 같은 숫자: 예상 현금 538,000 → 다음 달 쇼핑 148,000
const ctx = { shoppingRaw: 148_000, deferred: 0, livingTarget: 360_000, emergencyAmount: 30_000, cycleDays: 30, nextCash: 538_000, nextCycleDays: 31 }

describe('judge', () => {
  it('초과 → red. 현금이면 이번 달 생활비, 카드면 다음 달 생활비가 초과분만큼 깎인다', () =>
    expect(judge(189_000, ctx)).toEqual({
      verdict: 'red',
      overAmount: 41_000,
      reserve: 148_000,
      livingAfter: 319_000,
      livingAfterPerDay: 10_633,
      shoppingAfter: 0,
      livingExhausted: false,
      nextLivingNow: 360_000,
      nextLivingAfter: 360_000, // 다음 달 쇼핑 148,000 안에서 41,000 이 빠지므로 생활비는 그대로
      nextLivingAfterPerDay: 11_612,
      nextLivingExhausted: false,
    }))

  it('예산 안 → green, 카드로 내도 전액 이번 달 예산으로 묶는다', () =>
    expect(judge(59_000, ctx)).toEqual({
      verdict: 'green',
      overAmount: 0,
      reserve: 59_000,
      livingAfter: 360_000,
      livingAfterPerDay: 12_000,
      shoppingAfter: 89_000,
      livingExhausted: false,
      nextLivingNow: 360_000,
      nextLivingAfter: 360_000,
      nextLivingAfterPerDay: 11_612,
      nextLivingExhausted: false,
    }))

  it('카드로 미루면 다음 달 쇼핑 예산을 넘긴 만큼 다음 달 생활비가 깎인다', () =>
    expect(judge(400_000, ctx)).toMatchObject({ overAmount: 252_000, reserve: 148_000, nextLivingAfter: 256_000, nextLivingExhausted: false }))

  it('다음 달 생활비 바닥 → 카드로 못 산다, 이번 달은 아직 살 수 있다', () => {
    const v = judge(700_000, ctx)
    expect(v).toMatchObject({ overAmount: 552_000, nextLivingAfter: -44_000, nextLivingExhausted: true, livingAfter: -192_000, livingExhausted: true })
    expect(canBuy(v, 'card')).toBe(false)
    expect(canBuy(v, 'account')).toBe(false)
  })

  it('이번 달 생활비가 이미 깎여 있으면 현금은 막히고 카드는 열려 있을 수 있다', () => {
    const v = judge(200_000, { ...ctx, shoppingRaw: -300_000 })
    expect(v).toMatchObject({ livingAfter: -140_000, livingExhausted: true, nextLivingAfter: 308_000, nextLivingExhausted: false })
    expect(canBuy(v, 'account')).toBe(false)
    expect(canBuy(v, 'card')).toBe(true)
  })

  it('다음 달 현금이 이미 바닥이면 카드는 막히고 현금은 열려 있을 수 있다', () => {
    const v = judge(158_000, { ...ctx, nextCash: 380_000 })
    // 다음 달 쇼핑 −10,000 → 생활비 350,000. 10,000 더 미루면 340,000. 아직 괜찮다
    expect(v).toMatchObject({ overAmount: 10_000, nextLivingNow: 350_000, nextLivingAfter: 340_000, nextLivingExhausted: false })
    // 다음 달 현금 30,000 → 다음 달 생활비 이미 0. 1원도 못 미룬다
    expect(canBuy(judge(158_000, { ...ctx, nextCash: 30_000 }), 'card')).toBe(false)
    expect(canBuy(judge(158_000, { ...ctx, nextCash: 30_000 }), 'account')).toBe(true)
  })

  it('딱 같으면 green', () => expect(judge(148_000, ctx)).toMatchObject({ verdict: 'green', shoppingAfter: 0 }))

  it('쇼핑 0 이면 1원도 red', () =>
    expect(judge(1, { ...ctx, shoppingRaw: 0 })).toMatchObject({ verdict: 'red', overAmount: 1, livingAfter: 359_999 }))

  it('쇼핑 예산 음수인 달: 1원도 red, 생활비는 이미 깎인 값에서 줄어든다', () =>
    expect(judge(1, { ...ctx, shoppingRaw: -140_000 })).toMatchObject({
      verdict: 'red',
      overAmount: 1,
      livingAfter: 219_999,
      livingExhausted: false,
    }))

  it('생활비 바닥', () => expect(judge(600_000, ctx)).toMatchObject({ livingAfter: -92_000, livingExhausted: true }))

  it('생활비가 정확히 0 이 되면 바닥 아님', () =>
    expect(judge(508_000, ctx)).toMatchObject({ livingAfter: 0, livingExhausted: false }))
})

describe('isValidPrice', () => {
  it.each([
    [1, true],
    [100_000_000, true],
    [0, false],
    [-1, false],
    [100_000_001, false],
    [1.5, false],
    ['1', false],
    [NaN, false],
    [Infinity, false],
    [null, false],
  ])('%s → %s', (v, ok) => expect(isValidPrice(v)).toBe(ok))
})

describe('decisionFor', () => {
  it('시안 숫자 189,000 → 빨강, 사기 전·후 생활비', () =>
    expect(decisionFor(189_000, ctx)).toEqual({
      verdict: 'red',
      overAmount: 41_000,
      reserve: 148_000,
      livingAfter: 319_000,
      livingAfterPerDay: 10_633,
      shoppingAfter: 0,
      livingExhausted: false,
      nextLivingNow: 360_000,
      nextLivingAfter: 360_000,
      nextLivingAfterPerDay: 11_612,
      nextLivingExhausted: false,
      price: 189_000,
      shopping: 148_000,
      livingNow: 360_000,
      livingPerDay: 12_000,
    }))
  it('59,000 → 초록, 사고 나면 89,000', () => expect(decisionFor(59_000, ctx)).toMatchObject({ verdict: 'green', shoppingAfter: 89_000 }))
  it('쇼핑 예산 음수면 표시 0, 사기 전 생활비가 이미 깎여 있다', () =>
    expect(decisionFor(1, { ...ctx, shoppingRaw: -140_000 })).toMatchObject({
      verdict: 'red',
      shopping: 0,
      livingNow: 220_000,
      livingAfter: 219_999,
    }))
  it('카드로 미룬 게 있으면 사기 전 생활비는 미룬 만큼 덜 깎여 있다', () =>
    expect(decisionFor(1, { ...ctx, shoppingRaw: -140_000, deferred: 100_000 })).toMatchObject({ livingNow: 320_000, livingAfter: 319_999 }))
})
