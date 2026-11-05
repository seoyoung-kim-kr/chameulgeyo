import { Suspense } from 'react'
import { buttonClass } from '@/components/Button'
import { PhoneFrame } from '@/components/PhoneFrame'
import { LoginError } from './LoginError'

// 정적 페이지. 실패 표시(?error=1)만 클라이언트에서 읽는다 (searchParams 를 서버에서 읽으면 정적 셸이 깨진다).
// 버튼은 <Link> 가 아니라 <a>: /auth/google 은 구글로 보내는 Route Handler 라 전체 페이지 이동이어야 한다.
export default function LoginPage() {
  return (
    <PhoneFrame>
      <main className="flex flex-1 flex-col items-center px-5 pt-16 pb-8">
        <h1 className="text-2xl font-bold text-deep">♡ 소비신호등</h1>
        <div className="mt-12 flex w-full max-w-80 flex-col gap-3">
          <a href="/auth/google" className={buttonClass('soft', 'gap-3 text-base text-ink')}>
            <GoogleG />
            Google 계정으로 로그인
          </a>
          <Suspense fallback={<p className="min-h-10" />}>
            <LoginError />
          </Suspense>
        </div>
      </main>
    </PhoneFrame>
  )
}

/** 구글 브랜드 가이드의 표준 G 로고 */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
