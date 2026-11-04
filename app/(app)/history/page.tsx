import Link from 'next/link'
import { Suspense } from 'react'
import { shortDate, todayKst } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { getHistory, listMonths } from '@/lib/queries'
import { HistoryList, MonthSelect, type HistoryItem } from './HistoryList'

// 제목·닫기는 정적 셸. searchParams 는 Promise 그대로 <Suspense> 안에 넘겨 거기서 기다린다
// (페이지 최상단에서 await 하면 정적 셸까지 요청 시점으로 밀린다).
export default function HistoryPage({ searchParams }: PageProps<'/history'>) {
  return (
    <main className="flex min-h-[calc(100dvh-12px)] flex-col px-5 pt-5 pb-8 md:min-h-[832px]">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <span className="text-pink">♡</span> 기록
        </h1>
        <Link href="/" className="text-sm text-muted active:text-ink">
          닫기
        </Link>
      </header>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryLoader searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function HistoryLoader({ searchParams }: Pick<PageProps<'/history'>, 'searchParams'>) {
  const { ym: raw } = await searchParams
  const [history, saved] = await Promise.all([getHistory(typeof raw === 'string' ? raw : undefined), listMonths()])
  // 이번 주기 설정 전이어도 현재 달은 고를 수 있게 둔다
  const options = saved.includes(history.ym) ? saved : [history.ym, ...saved].sort().reverse()

  const items: HistoryItem[] = history.items.map((d) => ({
    id: d.id,
    name: d.name,
    price: d.price,
    verdict: d.verdict,
    choice: d.choice,
    overAmount: d.overAmount,
    date: shortDate(todayKst(d.decidedAt)),
  }))

  return (
    <>
      <MonthSelect value={history.ym} options={options} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-card bg-green-soft px-4 py-3">
          <p className="text-xs text-muted">참은 돈</p>
          <p className="text-xl font-bold text-green">+{formatWon(history.heldTotal)}</p>
        </div>
        <div className="rounded-card border border-line bg-white px-4 py-3">
          <p className="text-xs text-muted">그래도 산 돈</p>
          <p className="text-xl font-bold text-red">
            {history.boughtTotal > 0 ? '−' : ''}
            {formatWon(history.boughtTotal)}
          </p>
        </div>
      </div>
      {/* 달을 바꾸면 필터를 '전체'로 되돌린다 */}
      <HistoryList key={history.ym} items={items} />
    </>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-10 w-36 rounded-xl bg-soft" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-18 rounded-card bg-white" />
        <div className="h-18 rounded-card bg-white" />
      </div>
      <div className="h-11 rounded-full bg-soft" />
      <div className="h-48 rounded-card bg-white" />
    </div>
  )
}
