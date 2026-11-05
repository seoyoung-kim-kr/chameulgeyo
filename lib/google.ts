// 구글 로그인 (OAuth 2.0 + PKCE, scope openid email profile). 세션은 우리 jose 쿠키를 그대로 쓴다.
// 흐름: /auth/google → 구글 동의 화면 → /auth/google/callback → 세션 쿠키 → /
// 이 파일은 순수 로직만 둔다 (DB·쿠키는 주입). Route Handler 는 app/auth/google/ 아래.

export const STATE_COOKIE = 'cg_oauth_state'
export const VERIFIER_COOKIE = 'cg_oauth_verifier'
/** 구글 동의 화면에 머무를 수 있는 시간 */
export const OAUTH_COOKIE_TTL_SEC = 60 * 10
export const GOOGLE_SCOPES = ['openid', 'email', 'profile']
export const CALLBACK_PATH = '/auth/google/callback'

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export type GoogleProfile = {
  /** 구글 계정의 변하지 않는 id */
  sub: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

/**
 * ID 토큰 클레임 확인. 토큰은 구글 토큰 엔드포인트에서 TLS 로 직접 받았으므로 서명은 따로 검증하지 않는다
 * (OIDC Core 3.1.3.7). 그래도 발급자·대상·만료는 확인한다. 맞지 않으면 null.
 */
export function parseGoogleClaims(claims: unknown, clientId: string, nowSec: number): GoogleProfile | null {
  if (!claims || typeof claims !== 'object') return null
  const c = claims as Record<string, unknown>
  if (typeof c.iss !== 'string' || !GOOGLE_ISSUERS.includes(c.iss)) return null
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud]
  if (!aud.includes(clientId)) return null
  if (typeof c.exp !== 'number' || c.exp <= nowSec) return null
  if (typeof c.sub !== 'string' || c.sub.length === 0 || c.sub.length > 255) return null
  const email = typeof c.email === 'string' && c.email.length <= 320 ? c.email : null
  return {
    sub: c.sub,
    email,
    emailVerified: email !== null && c.email_verified === true,
    name: typeof c.name === 'string' ? c.name.slice(0, 100) : null,
  }
}

export type CallbackInput = {
  code: string | null
  state: string | null
  /** 구글이 돌려준 오류 (사용자가 취소하면 access_denied) */
  error: string | null
  storedState: string | undefined
  verifier: string | undefined
}

export type CallbackDeps = {
  /** code → ID 토큰 클레임 (lib/google-oauth.ts exchangeCode) */
  exchange: (code: string, verifier: string) => Promise<unknown>
  clientId: string
  now: () => number
  /** 프로필 → 사용자 id (lib/users.ts) */
  resolveUser: (profile: GoogleProfile) => Promise<number>
}

export type CallbackResult = { ok: true; userId: number } | { ok: false; reason: string }

/** 콜백 처리. state 가 쿠키와 다르면(다른 탭·위조) 토큰 교환 전에 끊는다. */
export async function completeGoogleLogin(input: CallbackInput, deps: CallbackDeps): Promise<CallbackResult> {
  if (input.error) return { ok: false, reason: `google:${input.error}` }
  if (!input.code || !input.state || !input.storedState || !input.verifier) return { ok: false, reason: 'missing' }
  if (input.state !== input.storedState) return { ok: false, reason: 'state' }
  let claims: unknown
  try {
    claims = await deps.exchange(input.code, input.verifier)
  } catch (e) {
    return { ok: false, reason: `exchange:${e instanceof Error ? e.message : 'unknown'}` }
  }
  const profile = parseGoogleClaims(claims, deps.clientId, Math.floor(deps.now() / 1000))
  if (!profile) return { ok: false, reason: 'claims' }
  return { ok: true, userId: await deps.resolveUser(profile) }
}

/** 기존 데이터(주인 없는 사용자)를 이 계정에 연결할지. 확인된 이메일이 OWNER_EMAIL 과 같을 때만 (대소문자 무시) */
export function isOwner(profile: GoogleProfile, ownerEmail: string | undefined): boolean {
  const owner = ownerEmail?.trim().toLowerCase()
  return !!owner && profile.emailVerified && profile.email?.toLowerCase() === owner
}

export function googleEnv(): { clientId: string; clientSecret: string } {
  // 콘솔에서 붙여넣을 때 섞이는 앞뒤 공백·줄바꿈은 잘라 낸다 (섞이면 구글이 invalid_client 를 낸다)
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  return { clientId, clientSecret }
}
