import { describe, it, expect } from 'vitest'
import { formatWon } from './format'

describe('formatWon', () => {
  it('천 단위 콤마', () => expect(formatWon(538000)).toBe('538,000'))
  it('0', () => expect(formatWon(0)).toBe('0'))
  it('음수는 U+2212 기호', () => expect(formatWon(-41000)).toBe('−41,000'))
})
