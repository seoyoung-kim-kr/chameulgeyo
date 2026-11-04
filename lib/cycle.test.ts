import { describe, it, expect } from 'vitest'
import { clampDay, cycleFor, daysBetween, daysInMonth, daysLeft, isCutoffDay, nextCycle, prevYm, shortDate, timeKst, todayKst } from './cycle'

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
