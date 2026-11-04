import Link from 'next/link'
import { Suspense } from 'react'
import { getHomeData } from '@/lib/queries'
import { CheckFlow } from './CheckFlow'

// 제목·닫기는 정적 셸, 쇼핑 가능액은 <Suspense> 안에서 요청마다 읽는다.
export default function CheckPage() {
  return (
    <main className="flex min-h-[calc(100dvh-12px)] flex-col px-5 pt-5 pb-8 md:min-h-[832px]">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <span className="text-pink">♡</span> 사고 싶은 것
        </h1>
        <Link href="/" className="text-sm text-muted active:text-ink">
          닫기
        </Link>
      </header>
      <Suspense fallback={<CheckSkeleton />}>
        <CheckLoader />
      </Suspense>
    </main>
  )
}

async function CheckLoader() {
  const { budget, month, cycle } = await getHomeData()
  return <CheckFlow shoppingRaw={budget.shoppingRaw} livingTarget={month.livingTarget} cycleDays={cycle.days} />
}

function CheckSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-12 rounded-card bg-white" />
      <div className="mx-auto mt-4 h-12 w-48 rounded-full bg-soft" />
      <div className="mx-auto mt-6 h-72 w-full max-w-80 rounded-card bg-white" />
    </div>
  )
}
