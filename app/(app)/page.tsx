import { Suspense } from 'react'
import { requireSession } from '@/lib/session'

// 임시 홈. Task 7 에서 실제 홈으로 바꾼다.
export default function Home() {
  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-bold text-deep">♡ 참을게요</h1>
      <Suspense fallback={<p className="mt-3 text-muted">확인 중…</p>}>
        <SessionStatus />
      </Suspense>
    </main>
  )
}

async function SessionStatus() {
  await requireSession()
  return <p className="mt-3 text-muted">로그인 됨 ♡</p>
}
