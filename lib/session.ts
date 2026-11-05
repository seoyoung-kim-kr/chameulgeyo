import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, getSessionSecret, verifySessionToken } from './session-token'

/** 로그인한 사용자 id. 없거나 만료·변조면 null */
export async function getUserId(): Promise<number | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token, getSessionSecret())
}

/** 데이터 조회 함수의 첫 줄에서 부른다. 세션이 없으면 /login 으로 보낸다. */
export async function requireUserId(): Promise<number> {
  const userId = await getUserId()
  if (userId === null) redirect('/login')
  return userId
}

export async function endSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
