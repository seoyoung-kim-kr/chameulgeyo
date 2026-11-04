import { describe, it, expect } from 'vitest'
import { cardDueDate, clampDay, cycleFor, daysBetween, daysInMonth, daysLeft, inCycle, isCutoffDay, nextCycle, prevYm, refundPlan, shortDate, statementDueDate, timeKst, todayKst } from './cycle'

describe('cycleFor', () => {
  it('월급일 5, 11/10 → 11/5~12/4 (30일)', () =>
    expect(cycleFor('2026-11-10', 5)).toEqual({ ym: '2026-11', start: '2026-11-05', end: '2026-12-04', days: 30 }))
  it('월급일 5, 11/3 → 10/5~11/4', () =>
    expect(cycleFor('2026-11-03', 5)).toEqual({ ym: '2026-10', start: '2026-10-05', end: '2026-11-04', days: 31 }))
  it('월급일 당일은 새 주기', () => expect(cycleFor('2026-11-05', 5).start).toBe('2026-11-05'))
  it('월급일 전날은 이전 주기의 마지막 날', () => expect(cycleFor('2026-12-04', 5).end).toBe('2026-12-04'))
  it('월급일 31 + 2월은 말일로 클램프', () =>
    expect(cycleFor('2026-02-10', 31)).toEqual({ ym: '2026-01', start: '2026-01-31', end: '2026-02-27', days: 28 }))
  it('월급일 31, 2/28 은 새 주기 시작', () =>
    expect(cycleFor('2026-02-28', 31)).toEqual({ ym: '2026-02', start: '2026-02-28', end: '2026-03-30', days: 31 }))
  it('월급일 1 → 달력 월과 같음', () =>
    expect(cycleFor('2026-11-20', 1)).toEqual({ ym: '2026-11', start: '2026-11-01', end: '2026-11-30', days: 30 }))
  it('연도 넘김: 월급일 5, 1/3 → 12/5~1/4', () =>
    expect(cycleFor('2027-01-03', 5)).toEqual({ ym: '2026-12', start: '2026-12-05', end: '2027-01-04', days: 31 }))
})

describe('todayKst', () => {
  it('UTC 23:30 는 KST 다음 날', () => expect(todayKst(new Date('2026-11-04T23:30:00Z'))).toBe('2026-11-05'))
  it('UTC 14:59 는 KST 같은 날 23:59', () => expect(todayKst(new Date('2026-11-04T14:59:00Z'))).toBe('2026-11-04'))
})

describe('daysInMonth / clampDay', () => {
  it('윤년 2월', () => expect(daysInMonth('2028-02')).toBe(29))
  it('평년 2월', () => expect(daysInMonth('2026-02')).toBe(28))
  it('clampDay', () => expect(clampDay('2026-04', 31)).toBe(30))
})

describe('isCutoffDay', () => {
  it('24일', () => expect(isCutoffDay('2026-11-24', 24)).toBe(true))
  it('23일은 아님', () => expect(isCutoffDay('2026-11-23', 24)).toBe(false))
  it('확정일 30 + 2월은 말일', () => expect(isCutoffDay('2026-02-28', 30)).toBe(true))
})

describe('nextCycle / prevYm / daysLeft', () => {
  it('nextCycle', () => expect(nextCycle(cycleFor('2026-11-10', 5), 5)).toEqual(cycleFor('2026-12-10', 5)))
  it('nextCycle 클램프 주기 다음', () => expect(nextCycle(cycleFor('2026-02-10', 31), 31).start).toBe('2026-02-28'))
  it('prevYm 연도 넘김', () => expect(prevYm('2026-01')).toBe('2025-12'))
  it('daysLeft 는 오늘 포함', () => expect(daysLeft('2026-12-04', cycleFor('2026-11-10', 5))).toBe(1))
  it('daysLeft 첫날', () => expect(daysLeft('2026-11-05', cycleFor('2026-11-10', 5))).toBe(30))
})

describe('daysBetween / timeKst / shortDate', () => {
  it('daysBetween 같은 날은 0, 앞선 날은 음수', () => {
    expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3)
    expect(daysBetween('2026-11-04', '2026-11-04')).toBe(0)
    expect(daysBetween('2026-11-04', '2026-11-01')).toBe(-3)
  })
  it('timeKst 는 UTC+9 의 HH:mm', () => {
    expect(timeKst(new Date('2026-11-04T23:30:00Z'))).toBe('08:30')
    expect(timeKst(new Date('2026-11-04T04:05:00Z'))).toBe('13:05')
  })
  it('shortDate 는 0 을 뗀 M/D', () => expect(shortDate('2026-11-05')).toBe('11/5'))
})

describe('inCycle / cardDueDate', () => {
  const nov = cycleFor('2026-11-10', 5) // 11/5~12/4
  it('시작·끝 포함', () => {
    expect(inCycle('2026-11-05', nov)).toBe(true)
    expect(inCycle('2026-12-04', nov)).toBe(true)
    expect(inCycle('2026-12-05', nov)).toBe(false)
  })
  it('월급일 = 출금일이면 주기 첫날', () => expect(cardDueDate(nov, 5)).toBe('2026-11-05'))
  it('출금일 15일', () => expect(cardDueDate(nov, 15)).toBe('2026-11-15'))
  it('출금일 1일은 다음 달 1일이 주기 안', () => expect(cardDueDate(nov, 1)).toBe('2026-12-01'))
  it('주기 안에 해당 날이 없으면 시작일', () => expect(cardDueDate(cycleFor('2026-02-10', 31), 30)).toBe('2026-01-31'))
})

describe('statementDueDate (사용일 → 출금일)', () => {
  it('확정일 24·출금일 5: 11/10 사용은 12/5', () => expect(statementDueDate('2026-11-10', 24, 5)).toBe('2026-12-05'))
  it('확정일 당일 사용은 그 청구서', () => expect(statementDueDate('2026-11-24', 24, 5)).toBe('2026-12-05'))
  it('확정일 다음 날 사용은 한 달 뒤', () => expect(statementDueDate('2026-11-25', 24, 5)).toBe('2027-01-05'))
  it('10/24 사용분이 11/5 에 빠진다 (검증용 데이터의 11/5 출금)', () => expect(statementDueDate('2026-10-24', 24, 5)).toBe('2026-11-05'))
  it('출금일이 확정일보다 뒤면 같은 달 (확정일 10·출금일 25)', () => expect(statementDueDate('2026-11-06', 10, 25)).toBe('2026-11-25'))
  it('말일 클램프 (1/31 사용, 확정일 30 → 2/28 확정 → 3/5)', () => expect(statementDueDate('2026-01-31', 30, 5)).toBe('2026-03-05'))
})

describe('refundPlan (확정일 24·출금일 5)', () => {
  it('청구 전 취소: 11/10 구매 → 11/15 취소는 12/5 대금에서 빼고 원복', () =>
    expect(refundPlan('2026-11-10', '2026-11-15', 24, 5)).toEqual({ originalDue: '2026-12-05', refundDue: '2026-12-05', beforeBilling: true }))
  it('확정일 뒤 취소여도 원래 대금이 출금 전이면 청구 전', () =>
    expect(refundPlan('2026-11-10', '2026-11-30', 24, 5)).toMatchObject({ refundDue: '2026-12-05', beforeBilling: true }))
  it('출금 후 환불: 10/20 구매(11/5 출금) → 11/10 환불은 12/5 대금에서 차감', () =>
    expect(refundPlan('2026-10-20', '2026-11-10', 24, 5)).toEqual({ originalDue: '2026-11-05', refundDue: '2026-12-05', beforeBilling: false }))
  it('출금일 당일 환불은 이미 출금된 것으로', () =>
    expect(refundPlan('2026-10-20', '2026-11-05', 24, 5)).toMatchObject({ beforeBilling: false, refundDue: '2026-12-05' }))
  it('출금 후 확정일 뒤 환불은 그다음 대금', () =>
    expect(refundPlan('2026-10-20', '2026-11-26', 24, 5)).toMatchObject({ beforeBilling: false, refundDue: '2027-01-05' }))
})
