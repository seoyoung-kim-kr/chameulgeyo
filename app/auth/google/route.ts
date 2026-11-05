import { NextResponse, connection, type NextRequest } from 'next/server'
import { CALLBACK_PATH, GOOGLE_SCOPES, OAUTH_COOKIE_TTL_SEC, STATE_COOKIE, VERIFIER_COOKIE, googleEnv } from '@/lib/google'
import { authorizationUrl, randomToken } from '@/lib/google-oauth'

// 로그인 시작: state·PKCE verifier 를 짧은 httpOnly 쿠키에 두고 구글 동의 화면으로 보낸다.
// 리디렉션 URI 는 요청 주소 기준이라 production·고정 미리보기 도메인·localhost 가 각자 자기 콜백을 쓴다
// (구글 콘솔에 그 주소들이 등록돼 있어야 한다).
export async function GET(request: NextRequest) {
  // Cache Components 에서는 GET Route Handler 도 빌드 때 프리렌더된다. 요청 시점에만 돌게 여기서 멈춘다
  // (이게 없으면 빌드 환경에 GOOGLE_* 가 없을 때 빌드가 실패했다)
  await connection()
  const { clientId, clientSecret } = googleEnv()
  const state = randomToken()
  const verifier = randomToken()
  const redirectUri = new URL(CALLBACK_PATH, request.nextUrl.origin).toString()
  const url = authorizationUrl({ clientId, clientSecret, redirectUri }, state, verifier, GOOGLE_SCOPES)

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
