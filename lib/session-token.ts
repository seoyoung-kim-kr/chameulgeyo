// 세션 토큰 발급·검증. next/headers 를 쓰지 않아 proxy.ts 와 테스트에서도 import 할 수 있다.
// sub = users.id (문자열). PIN 시절 토큰(sub 'owner')은 숫자가 아니라서 자동으로 거부된다.
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'cg_session'
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30

const toKey = (secret: string) => new TextEncoder().encode(secret)
const USER_ID_RE = /^[1-9][0-9]{0,9}$/

export async function createSessionToken(secret: string, userId: number, now: Date = new Date()): Promise<string> {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('invalid user id')
  const iat = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_TTL_SEC)
    .sign(toKey(secret))
}

/** 유효하면 사용자 id, 아니면 null */
export async function verifySessionToken(token: string, secret: string): Promise<number | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, toKey(secret), { algorithms: ['HS256'] })
    return typeof payload.sub === 'string' && USER_ID_RE.test(payload.sub) ? Number(payload.sub) : null
  } catch {
    return null
  }
}

/** SESSION_SECRET 이 없거나 짧으면 조용히 넘어가지 않고 실패한다. */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set and at least 32 characters long')
  return secret
}

/** 세션 쿠키 속성. 로그인 콜백(Route Handler)이 응답에 직접 붙인다. */
export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_SEC,
  path: '/',
})
