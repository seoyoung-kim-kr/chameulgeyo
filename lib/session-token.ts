// 세션 토큰 발급·검증. next/headers 를 쓰지 않아 proxy.ts 와 테스트에서도 import 할 수 있다.
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'cg_session'
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30
const SUBJECT = 'owner'

const toKey = (secret: string) => new TextEncoder().encode(secret)

export async function createSessionToken(secret: string, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUBJECT)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_TTL_SEC)
    .sign(toKey(secret))
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, toKey(secret), { algorithms: ['HS256'], subject: SUBJECT })
    return true
  } catch {
    return false
  }
}

/** SESSION_SECRET 이 없거나 짧으면 조용히 넘어가지 않고 실패한다. */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set and at least 32 characters long')
  return secret
}
