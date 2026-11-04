import { describe, it, expect } from 'vitest'
import { isPinFormat, pinMatches } from './pin'

describe('isPinFormat', () => {
  it.each([
    ['123456', true],
    ['000000', true],
    ['12345', false],
    ['1234567', false],
    ['12a456', false],
    [' 23456', false],
  ])('%s → %s', (v, ok) => expect(isPinFormat(v)).toBe(ok))
})

describe('pinMatches', () => {
  it('같으면 true', () => expect(pinMatches('123456', '123456')).toBe(true))
  it('다르면 false', () => expect(pinMatches('123457', '123456')).toBe(false))
  it('길이가 달라도 예외 없이 false', () => expect(pinMatches('1', '123456')).toBe(false))
  it('설정된 PIN 이 없으면 항상 false', () => expect(pinMatches('123456', undefined)).toBe(false))
  it('설정된 PIN 이 형식에 안 맞으면 false', () => expect(pinMatches('', '')).toBe(false))
})
