import { createHash, timingSafeEqual } from 'node:crypto'

export const PIN_LENGTH = 6

export function isPinFormat(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin)
}

const digest = (s: string) => createHash('sha256').update(s).digest()

/** 상수 시간 비교. 길이가 달라도 예외 없이 false (해시끼리 비교하므로 길이가 항상 같다). */
export function pinMatches(input: string, expected: string | undefined): boolean {
  if (!expected || !isPinFormat(expected) || !isPinFormat(input)) return false
  return timingSafeEqual(digest(input), digest(expected))
}
