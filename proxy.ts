import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, getSessionSecret, verifySessionToken } from '@/lib/session-token'

// 낙관적 검사: 쿠키 서명만 보고 리다이렉트한다. DB 는 조회하지 않는다.
// 실제 보안 검증은 lib/queries.ts 의 requireUserId() 와 서버 액션의 withUser() 가 한다.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // 구글 로그인 시작·콜백은 로그인 전에 지나가야 한다
  if (pathname.startsWith('/auth/')) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const loggedIn = token ? (await verifySessionToken(token, getSessionSecret())) !== null : false
  const onLogin = pathname === '/login'

  if (!loggedIn && !onLogin) return NextResponse.redirect(new URL('/login', request.url))
  if (loggedIn && onLogin) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)',
      // 서버 액션 요청은 건너뛴다. 세션이 만료됐을 때 액션이 리다이렉트 대신
      // { ok: false, error: 'UNAUTHORIZED' } 를 돌려줘야 클라이언트가 /login 으로 보낼 수 있다.
      missing: [{ type: 'header', key: 'next-action' }],
    },
  ],
}
