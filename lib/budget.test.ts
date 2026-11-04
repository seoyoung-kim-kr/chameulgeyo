import { describe, it, expect } from 'vitest'
import { computeBudget, decisionFor, isValidPrice, judge } from './budget'

// 기획서 UI 시안 숫자: 월급 2,800,000 − 고정 1,350,000 − 카드 912,000 = 이번 주기 현금 538,000
const base = { cash: 538_000, livingTarget: 360_000, emergencyAmount: 30_000, spentShopping: 0, cycleDays: 30 }

describe('computeBudget', () => {
  it('시안 숫자', () =>
    expect(computeBudget(base)).toEqual({
      available: 538_000,
      shoppingRaw: 148_000,
      shopping: 148_000,
      shoppingExhausted: false,
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
})

describe('judge', () => {
  const ctx = { shoppingRaw: 148_000, livingTarget: 360_000, cycleDays: 30 }

  it('초과 → red, 초과분이 생활비를 깎음', () =>
    expect(judge(189_000, ctx)).toEqual({
      verdict: 'red',
      overAmount: 41_000,
      livingAfter: 319_000,
      livingAfterPerDay: 10_633,
      shoppingAfter: 0,
      livingExhausted: false,
    }))

  it('예산 안 → green', () =>
    expect(judge(59_000, ctx)).toEqual({
      verdict: 'green',
      overAmount: 0,
      livingAfter: 360_000,
      livingAfterPerDay: 12_000,
      shoppingAfter: 89_000,
      livingExhausted: false,
    }))

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
  const ctx = { shoppingRaw: 148_000, livingTarget: 360_000, cycleDays: 30 }
  it('시안 숫자 189,000 → 빨강, 사기 전·후 생활비', () =>
    expect(decisionFor(189_000, ctx)).toEqual({
      verdict: 'red',
      overAmount: 41_000,
      livingAfter: 319_000,
      livingAfterPerDay: 10_633,
      shoppingAfter: 0,
      livingExhausted: false,
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
})
