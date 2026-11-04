import { describe, it, expect } from 'vitest'
import { SESSION_TTL_SEC, createSessionToken, verifySessionToken } from './session-token'

const secret = 'x'.repeat(32)

describe('session token', () => {
  it('발급한 토큰은 검증 통과', async () => expect(await verifySessionToken(await createSessionToken(secret), secret)).toBe(true))
  it('다른 secret 이면 실패', async () =>
    expect(await verifySessionToken(await createSessionToken(secret), 'y'.repeat(32))).toBe(false))
  it('변조 토큰 실패', async () => {
    const t = await createSessionToken(secret)
    expect(await verifySessionToken(t.slice(0, -2) + 'zz', secret)).toBe(false)
  })
  it('만료 토큰 실패', async () => {
    const t = await createSessionToken(secret, new Date(Date.now() - (SESSION_TTL_SEC + 60) * 1000))
    expect(await verifySessionToken(t, secret)).toBe(false)
  })
  it('빈 문자열 실패', async () => expect(await verifySessionToken('', secret)).toBe(false))
})
