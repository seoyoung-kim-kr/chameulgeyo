import { describe, it, expect, vi } from 'vitest'
import { completeGoogleLogin, isOwner, parseGoogleClaims, type CallbackDeps, type GoogleProfile } from './google'

const CLIENT = 'client-1.apps.googleusercontent.com'
const NOW = 1_800_000_000
const claims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: NOW + 3600,
  sub: '1234567890',
  email: 'Me@Example.com',
  email_verified: true,
  name: '서영',
}

describe('parseGoogleClaims', () => {
  it('정상', () =>
    expect(parseGoogleClaims(claims, CLIENT, NOW)).toEqual({ sub: '1234567890', email: 'Me@Example.com', emailVerified: true, name: '서영' }))
  it('iss 없는 이름도 허용 (accounts.google.com)', () => expect(parseGoogleClaims({ ...claims, iss: 'accounts.google.com' }, CLIENT, NOW)).not.toBeNull())
  it('다른 발급자', () => expect(parseGoogleClaims({ ...claims, iss: 'https://evil.example' }, CLIENT, NOW)).toBeNull())
  it('다른 클라이언트용 토큰', () => expect(parseGoogleClaims({ ...claims, aud: 'other' }, CLIENT, NOW)).toBeNull())
  it('aud 배열에 포함', () => expect(parseGoogleClaims({ ...claims, aud: ['x', CLIENT] }, CLIENT, NOW)).not.toBeNull())
  it('만료', () => expect(parseGoogleClaims({ ...claims, exp: NOW }, CLIENT, NOW)).toBeNull())
  it('sub 없음', () => expect(parseGoogleClaims({ ...claims, sub: '' }, CLIENT, NOW)).toBeNull())
  it('email_verified 가 문자열 "true" 면 확인 안 된 것으로', () =>
    expect(parseGoogleClaims({ ...claims, email_verified: 'true' }, CLIENT, NOW)?.emailVerified).toBe(false))
  it('객체가 아니면 null', () => expect(parseGoogleClaims('x', CLIENT, NOW)).toBeNull())
})

describe('isOwner', () => {
  const p: GoogleProfile = { sub: 's', email: 'Me@Example.com', emailVerified: true, name: null }
  it('대소문자·공백 무시', () => expect(isOwner(p, ' me@example.com ')).toBe(true))
  it('확인 안 된 이메일은 아님', () => expect(isOwner({ ...p, emailVerified: false }, 'me@example.com')).toBe(false))
  it('OWNER_EMAIL 없음', () => expect(isOwner(p, undefined)).toBe(false))
  it('빈 OWNER_EMAIL', () => expect(isOwner(p, '')).toBe(false))
  it('다른 이메일', () => expect(isOwner(p, 'you@example.com')).toBe(false))
})

describe('completeGoogleLogin', () => {
  const deps = (over: Partial<CallbackDeps> = {}): CallbackDeps => ({
    exchange: vi.fn(async () => claims),
    clientId: CLIENT,
    now: () => NOW * 1000,
    resolveUser: vi.fn(async () => 42),
    ...over,
  })
  const input = { code: 'c', state: 's1', error: null, storedState: 's1', verifier: 'v' }

  it('정상 → 사용자 id', async () => expect(await completeGoogleLogin(input, deps())).toEqual({ ok: true, userId: 42 }))
  it('state 가 다르면 토큰 교환을 하지 않는다', async () => {
    const d = deps()
    expect(await completeGoogleLogin({ ...input, state: 's2' }, d)).toEqual({ ok: false, reason: 'state' })
    expect(d.exchange).not.toHaveBeenCalled()
  })
  it('state 쿠키 없음 (만료·다른 브라우저)', async () =>
    expect(await completeGoogleLogin({ ...input, storedState: undefined }, deps())).toEqual({ ok: false, reason: 'missing' }))
  it('사용자가 취소', async () =>
    expect(await completeGoogleLogin({ ...input, code: null, error: 'access_denied' }, deps())).toEqual({ ok: false, reason: 'google:access_denied' }))
  it('토큰 교환 실패', async () =>
    expect(await completeGoogleLogin(input, deps({ exchange: async () => Promise.reject(new Error('invalid_grant')) }))).toEqual({
      ok: false,
      reason: 'exchange:invalid_grant',
    }))
  it('클레임이 맞지 않으면 사용자를 만들지 않는다', async () => {
    const d = deps({ exchange: async () => ({ ...claims, aud: 'other' }) })
    expect(await completeGoogleLogin(input, d)).toEqual({ ok: false, reason: 'claims' })
    expect(d.resolveUser).not.toHaveBeenCalled()
  })
})

describe('googleEnv', () => {
  it('공백·줄바꿈(\\r 포함)은 위치와 상관없이 지운다', async () => {
    const { googleEnv } = await import('./google')
    process.env.GOOGLE_CLIENT_ID = ' 123-abc\r\n.apps.googleusercontent.com\n'
    process.env.GOOGLE_CLIENT_SECRET = 'sec\nret '
    expect(googleEnv()).toEqual({ clientId: '123-abc.apps.googleusercontent.com', clientSecret: 'secret' })
    delete process.env.GOOGLE_CLIENT_ID
    expect(() => googleEnv()).toThrow()
    delete process.env.GOOGLE_CLIENT_SECRET
  })
})
