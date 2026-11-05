import { Google, generateCodeVerifier, generateState } from 'arctic'
import { NextResponse, type NextRequest } from 'next/server'
import { CALLBACK_PATH, GOOGLE_SCOPES, OAUTH_COOKIE_TTL_SEC, STATE_COOKIE, VERIFIER_COOKIE, googleEnv } from '@/lib/google'

// 로그인 시작: state·PKCE verifier 를 짧은 httpOnly 쿠키에 두고 구글 동의 화면으로 보낸다.
// 리디렉션 URI 는 요청 주소 기준이라 production·고정 미리보기 도메인·localhost 가 각자 자기 콜백을 쓴다
// (구글 콘솔에 그 주소들이 등록돼 있어야 한다).
export async function GET(request: NextRequest) {
  const { clientId, clientSecret } = googleEnv()
  const state = generateState()
  const verifier = generateCodeVerifier()
  const google = new Google(clientId, clientSecret, new URL(CALLBACK_PATH, request.nextUrl.origin).toString())
  const url = google.createAuthorizationURL(state, verifier, GOOGLE_SCOPES)
  // 여러 구글 계정이 있으면 고르게 한다 (실수로 다른 계정으로 들어가 빈 사용자가 생기는 일을 줄인다)
  url.searchParams.set('prompt', 'select_account')

  const res = NextResponse.redirect(url)
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: OAUTH_COOKIE_TTL_SEC,
    path: '/auth/google',
  }
  res.cookies.set(STATE_COOKIE, state, opts)
  res.cookies.set(VERIFIER_COOKIE, verifier, opts)
  return res
}
