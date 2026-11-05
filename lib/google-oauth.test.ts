import { describe, it, expect, vi } from 'vitest'
import { SignJWT } from 'jose'
import { authorizationUrl, codeChallenge, exchangeCode, randomToken } from './google-oauth'

const client = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://sobi.example/auth/google/callback' }

describe('PKCE', () => {
  it('RFC 7636 부록 B 예시', () =>
    expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'))
  it('randomToken 은 43자 base64url, 매번 다름', () => {
    const a = randomToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(a)
  })
})

describe('authorizationUrl', () => {
  it('필수 파라미터', () => {
    const u = authorizationUrl(client, 'st', 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', ['openid', 'email', 'profile'])
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(u.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'cid',
      redirect_uri: client.redirectUri,
      scope: 'openid email profile',
      state: 'st',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    })
  })
})

describe('exchangeCode', () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  it('id_token 클레임을 돌려주고, 요청에 verifier·secret 을 싣는다', async () => {
    const idToken = await new SignJWT({ sub: '123', email: 'a@b.c' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('k'.repeat(32)))
    const fetchFn = vi.fn(async () => json(200, { id_token: idToken, access_token: 'x' }))
    const claims = await exchangeCode(client, 'the-code', 'ver', fetchFn as unknown as typeof fetch)
    expect(claims).toMatchObject({ sub: '123', email: 'a@b.c' })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: client.redirectUri,
      client_id: 'cid',
      client_secret: 'secret',
      code_verifier: 'ver',
    })
  })
  it('오류 응답이면 throw (오류 코드 포함)', async () =>
    await expect(exchangeCode(client, 'c', 'v', (async () => json(400, { error: 'invalid_grant' })) as typeof fetch)).rejects.toThrow('token 400 invalid_grant'))
  it('id_token 이 없으면 throw', async () =>
    await expect(exchangeCode(client, 'c', 'v', (async () => json(200, { access_token: 'x' })) as typeof fetch)).rejects.toThrow('no id_token'))
})
