import { describe, it, expect } from 'vitest'
import { saveMonthSchema } from './validation'

const valid = {
  payDay: 5,
  cardCutoffDay: 24,
  salary: 2_800_000,
  cardBalance: 912_000,
  livingTarget: 360_000,
  emergencyAmount: 30_000,
  fixed: [
    { name: '월세', amount: 650_000 },
    { name: '적금', amount: 400_000 },
  ],
}

const fails = (patch: Record<string, unknown>) => expect(saveMonthSchema.safeParse({ ...valid, ...patch }).success).toBe(false)

describe('saveMonthSchema', () => {
  it('정상 입력 통과', () => expect(saveMonthSchema.safeParse(valid).success).toBe(true))
  it('고정지출 0개도 통과', () => expect(saveMonthSchema.safeParse({ ...valid, fixed: [] }).success).toBe(true))
  it('이름 앞뒤 공백은 잘라낸다', () =>
    expect(saveMonthSchema.parse({ ...valid, fixed: [{ name: '  월세 ', amount: 1 }] }).fixed[0].name).toBe('월세'))
  it('payDay 0 실패', () => fails({ payDay: 0 }))
  it('payDay 32 실패', () => fails({ payDay: 32 }))
  it('cardCutoffDay 0 실패', () => fails({ cardCutoffDay: 0 }))
  it('salary 1.5 실패', () => fails({ salary: 1.5 }))
  it('salary 음수 실패', () => fails({ salary: -1 }))
  it('salary 10억 초과 실패', () => fails({ salary: 1_000_000_001 }))
  it('cardBalance 문자열 실패', () => fails({ cardBalance: '912000' }))
  it('fixed 이름 빈 값 실패', () => fails({ fixed: [{ name: '', amount: 1 }] }))
  it('fixed 이름 공백만 실패', () => fails({ fixed: [{ name: '   ', amount: 1 }] }))
  it('fixed 이름 41자 실패', () => fails({ fixed: [{ name: 'a'.repeat(41), amount: 1 }] }))
  it('fixed 31개 실패', () => fails({ fixed: Array.from({ length: 31 }, (_, i) => ({ name: `항목${i}`, amount: 1 })) }))
  it('fixed 30개 통과', () =>
    expect(saveMonthSchema.safeParse({ ...valid, fixed: Array.from({ length: 30 }, (_, i) => ({ name: `항목${i}`, amount: 1 })) }).success).toBe(true))
})
