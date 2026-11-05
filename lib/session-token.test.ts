import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import { SESSION_TTL_SEC, createSessionToken, verifySessionToken } from './session-token'

const secret = 'x'.repeat(32)

describe('session token', () => {
  it('발급한 토큰은 사용자 id 를 돌려준다', async () => expect(await verifySessionToken(await createSessionToken(secret, 7), secret)).toBe(7))
  it('다른 secret 이면 실패', async () =>
    expect(await verifySessionToken(await createSessionToken(secret, 7), 'y'.repeat(32))).toBeNull())
  it('변조 토큰 실패', async () => {
    const t = await createSessionToken(secret, 7)
    expect(await verifySessionToken(t.slice(0, -2) + 'zz', secret)).toBeNull()
  })
  it('만료 토큰 실패', async () => {
    const t = await createSessionToken(secret, 7, new Date(Date.now() - (SESSION_TTL_SEC + 60) * 1000))
    expect(await verifySessionToken(t, secret)).toBeNull()
  })
  it('빈 문자열 실패', async () => expect(await verifySessionToken('', secret)).toBeNull())
  it("PIN 시절 토큰(sub 'owner')은 거부", async () => {
    const old = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('owner').setIssuedAt().setExpirationTime('1d').sign(new TextEncoder().encode(secret))
    expect(await verifySessionToken(old, secret)).toBeNull()
  })
  it('잘못된 사용자 id 로는 발급하지 않는다', async () => {
    await expect(createSessionToken(secret, 0)).rejects.toThrow()
    await expect(createSessionToken(secret, 1.5)).rejects.toThrow()
  })
})
