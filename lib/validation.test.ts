import { describe, it, expect } from 'vitest'
import { chooseSchema, saveCardBillsSchema, saveMonthSchema } from './validation'

const valid = {
  payDay: 5,
  cardCutoffDay: 24,
  cardPayDay: 5,
  salary: 2_800_000,
  thisBill: 1_024_984,
  nextBill: 772_358,
  livingTarget: 360_000,
  emergencyAmount: 30_000,
  fixed: [
    { name: '월세', amount: 650_000, method: 'account' },
    { name: '통신비', amount: 60_000, method: 'card' },
    { name: '적금', amount: 400_000, method: null },
  ],
}

const fails = (patch: Record<string, unknown>) => expect(saveMonthSchema.safeParse({ ...valid, ...patch }).success).toBe(false)

describe('saveMonthSchema', () => {
  it('정상 입력 통과', () => expect(saveMonthSchema.safeParse(valid).success).toBe(true))
  it('고정지출 0개도 통과', () => expect(saveMonthSchema.safeParse({ ...valid, fixed: [] }).success).toBe(true))
  it('이름 앞뒤 공백은 잘라낸다', () =>
    expect(saveMonthSchema.parse({ ...valid, fixed: [{ name: '  월세 ', amount: 1, method: null }] }).fixed[0].name).toBe('월세'))
  it('payDay 0 실패', () => fails({ payDay: 0 }))
  it('payDay 32 실패', () => fails({ payDay: 32 }))
  it('cardCutoffDay 0 실패', () => fails({ cardCutoffDay: 0 }))
  it('salary 1.5 실패', () => fails({ salary: 1.5 }))
  it('salary 음수 실패', () => fails({ salary: -1 }))
  it('salary 10억 초과 실패', () => fails({ salary: 1_000_000_001 }))
  it('thisBill 문자열 실패', () => fails({ thisBill: '912000' }))
  it('nextBill 음수 실패', () => fails({ nextBill: -1 }))
  it('cardPayDay 0 실패', () => fails({ cardPayDay: 0 }))
  it('결제 수단 이상값 실패', () => fails({ fixed: [{ name: '월세', amount: 1, method: 'cash' }] }))
  it('결제 수단 없음(null, 미분류) 통과', () => expect(saveMonthSchema.safeParse({ ...valid, fixed: [{ name: '월세', amount: 1, method: null }] }).success).toBe(true))
  it('fixed 이름 빈 값 실패', () => fails({ fixed: [{ name: '', amount: 1 }] }))
  it('fixed 이름 공백만 실패', () => fails({ fixed: [{ name: '   ', amount: 1 }] }))
  it('fixed 이름 41자 실패', () => fails({ fixed: [{ name: 'a'.repeat(41), amount: 1 }] }))
  it('fixed 31개 실패', () => fails({ fixed: Array.from({ length: 31 }, (_, i) => ({ name: `항목${i}`, amount: 1, method: null })) }))
  it('fixed 30개 통과', () =>
    expect(saveMonthSchema.safeParse({ ...valid, fixed: Array.from({ length: 30 }, (_, i) => ({ name: `항목${i}`, amount: 1, method: null })) }).success).toBe(true))
})

describe('chooseSchema', () => {
  const ok = { id: 'V1StGXR8_Z5jdHi6B-myT', name: '코트', price: 189_000, choice: 'held' as const }
  const bad = (patch: object) => expect(chooseSchema.safeParse({ ...ok, ...patch }).success).toBe(false)
  it('정상 입력 통과', () => expect(chooseSchema.parse(ok)).toEqual(ok))
  it('이름 없음(null) 통과', () => expect(chooseSchema.parse({ ...ok, name: null }).name).toBeNull())
  it('공백 이름은 null 로', () => expect(chooseSchema.parse({ ...ok, name: '   ' }).name).toBeNull())
  it('이름 61자 실패', () => bad({ name: 'a'.repeat(61) }))
  it('id 20자 실패', () => bad({ id: 'a'.repeat(20) }))
  it('id 허용 외 문자 실패', () => bad({ id: 'a'.repeat(20) + '!' }))
  it('가격 0 실패', () => bad({ price: 0 }))
  it('가격 1억 초과 실패', () => bad({ price: 100_000_001 }))
  it('가격 소수 실패', () => bad({ price: 1.5 }))
  it('choice 이상값 실패', () => bad({ choice: 'maybe' }))
})

describe('saveCardBillsSchema', () => {
  const ok = {
    thisBill: { dueDate: '2026-11-05', amount: 1_024_984, paid: true },
    nextBill: { dueDate: '2026-12-05', amount: 772_358, includesCardFixed: true },
  }
  it('정상 입력 통과', () => expect(saveCardBillsSchema.safeParse(ok).success).toBe(true))
  it('날짜 형식이 아니면 실패', () => expect(saveCardBillsSchema.safeParse({ ...ok, nextBill: { ...ok.nextBill, dueDate: '12/5' } }).success).toBe(false))
  it('금액 소수 실패', () => expect(saveCardBillsSchema.safeParse({ ...ok, thisBill: { ...ok.thisBill, amount: 1.5 } }).success).toBe(false))
})
