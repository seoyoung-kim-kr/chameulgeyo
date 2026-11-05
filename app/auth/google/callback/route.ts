import { NextResponse, connection, type NextRequest } from 'next/server'
import { db } from '@/db'
import { CALLBACK_PATH, STATE_COOKIE, VERIFIER_COOKIE, completeGoogleLogin, googleEnv } from '@/lib/google'
import { exchangeCode } from '@/lib/google-oauth'
import { SESSION_COOKIE, createSessionToken, getSessionSecret, sessionCookieOptions } from '@/lib/session-token'
import { findOrCreateUser } from '@/lib/users'

// 구글이 돌려보내는 곳. 성공하면 세션 쿠키를 붙여 홈으로, 실패하면 /login?error=1.
// 실패 원인은 화면에 나누지 않고 서버 로그에만 남긴다.
export async function GET(request: NextRequest) {
  await connection() // 요청 시점에만 (빌드 때 프리렌더하지 않는다)
  const { origin, searchParams } = request.nextUrl
  const { clientId, clientSecret } = googleEnv()
  const client = { clientId, clientSecret, redirectUri: new URL(CALLBACK_PATH, origin).toString() }

  const result = await completeGoogleLogin(
    {
      code: searchParams.get('code'),
      state: searchParams.get('state'),
      error: searchParams.get('error'),
      storedState: request.cookies.get(STATE_COOKIE)?.value,
      verifier: request.cookies.get(VERIFIER_COOKIE)?.value,
    },
    {
      exchange: (code, verifier) => exchangeCode(client, code, verifier),
      clientId,
      now: Date.now,
      resolveUser: (profile) => db.transaction((tx) => findOrCreateUser(tx, profile, process.env.OWNER_EMAIL)),
    },
  )

  let res: NextResponse
  if (result.ok) {
    res = NextResponse.redirect(new URL('/', origin))
    res.cookies.set(SESSION_COOKIE, await createSessionToken(getSessionSecret(), result.userId), sessionCookieOptions())
  } else {
    console.warn('[auth/google] login failed', result.reason)
    res = NextResponse.redirect(new URL('/login?error=1', origin))
  }
  res.cookies.delete({ name: STATE_COOKIE, path: '/auth/google' })
  res.cookies.delete({ name: VERIFIER_COOKIE, path: '/auth/google' })
  return res
}
