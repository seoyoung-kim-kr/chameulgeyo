import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, SESSION_TTL_SEC, createSessionToken, getSessionSecret, verifySessionToken } from './session-token'

export async function getSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return false
  return verifySessionToken(token, getSessionSecret())
}

/** 데이터 조회 함수의 첫 줄에서 부른다. 세션이 없으면 /login 으로 보낸다. */
export async function requireSession(): Promise<void> {
  if (!(await getSession())) redirect('/login')
}

export async function startSession(): Promise<void> {
  const token = await createSessionToken(getSessionSecret())
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SEC,
    path: '/',
  })
}
