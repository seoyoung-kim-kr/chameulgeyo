import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, getSessionSecret, verifySessionToken } from '@/lib/session-token'

// 낙관적 검사: 쿠키 서명만 보고 리다이렉트한다. DB 는 조회하지 않는다.
// 실제 보안 검증은 lib/queries.ts 의 requireSession() 과 서버 액션의 withSession() 이 한다.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const loggedIn = token ? await verifySessionToken(token, getSessionSecret()) : false
  const onLogin = request.nextUrl.pathname === '/login'

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
