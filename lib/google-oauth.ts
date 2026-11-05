// 구글 OAuth 2.0 + PKCE 의 HTTP 부분 (인가 URL 만들기, code → 토큰 교환).
// 처음엔 arctic 을 썼으나 npm 에서 deprecated("no longer supported")라 직접 둔다. 하는 일이 이 두 가지뿐이다.
// 서버 전용 (node:crypto). 클레임 확인은 lib/google.ts 의 parseGoogleClaims.
import { createHash, randomBytes } from 'node:crypto'
import { decodeJwt } from 'jose'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/** state·code_verifier 용 임의 문자열 (32바이트, base64url 43자. RFC 7636 은 43~128자) */
export const randomToken = () => randomBytes(32).toString('base64url')

/** PKCE S256: base64url(sha256(verifier)) */
export const codeChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

export type OAuthClient = { clientId: string; clientSecret: string; redirectUri: string }

export function authorizationUrl(c: OAuthClient, state: string, verifier: string, scopes: string[]): URL {
  const url = new URL(AUTH_ENDPOINT)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: 'S256',
    // 여러 구글 계정이 있으면 고르게 한다 (실수로 다른 계정으로 들어가 빈 사용자가 생기는 일을 줄인다)
    prompt: 'select_account',
  }).toString()
  return url
}

/**
 * code → ID 토큰 클레임. 토큰 엔드포인트에서 TLS 로 직접 받았으므로 서명은 검증하지 않고 해석만 한다
 * (OIDC Core 3.1.3.7). 발급자·대상·만료 확인은 parseGoogleClaims 가 한다. 실패하면 throw.
 */
export async function exchangeCode(c: OAuthClient, code: string, verifier: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.redirectUri,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code_verifier: verifier,
    }),
  })
  const body = (await res.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null
  if (!res.ok) throw new Error(`token ${res.status} ${typeof body?.error === 'string' ? body.error : ''}`.trim())
  if (typeof body?.id_token !== 'string') throw new Error('token: no id_token')
  return decodeJwt(body.id_token)
}
