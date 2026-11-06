import Link from 'next/link'
import { Suspense } from 'react'
import { buttonClass } from '@/components/Button'
import { Card, Screen } from '@/components/Screen'
import { shortDate, todayKst } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { getHistory, listMonths } from '@/lib/queries'
import { HistoryList, MonthSelect, type HistoryItem } from './HistoryList'

// 제목·닫기는 정적 셸. searchParams 는 Promise 그대로 <Suspense> 안에 넘겨 거기서 기다린다
// (페이지 최상단에서 await 하면 정적 셸까지 요청 시점으로 밀린다).
export default function HistoryPage({ searchParams }: PageProps<'/history'>) {
  return (
    <Screen
      title="기록"
      action={
        <Link href="/" className={buttonClass('text', 'h-8 px-2 text-sm')}>
          닫기
        </Link>
      }
    >
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryLoader searchParams={searchParams} />
      </Suspense>
    </Screen>
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
    paymentMethod: d.paymentMethod ?? 'card',
    overAmount: d.overAmount,
    date: shortDate(todayKst(d.decidedAt)),
    refund: d.canceledAt ? { due: d.refundDueDate ? shortDate(d.refundDueDate) : null, beforeBilling: d.refundBeforeBilling ?? true } : null,
  }))

  return (
    <>
      <MonthSelect value={history.ym} options={options} />
      <div className="grid grid-cols-2 gap-3">
        <Card tone="green">
          <p className="text-sm text-muted">아낀 돈</p>
          <p className="mt-2 text-lg font-bold text-green">+{formatWon(history.heldTotal)}원</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">산 돈</p>
          <p className="mt-2 text-lg font-bold text-red">
            {history.boughtTotal > 0 ? '−' : ''}
            {formatWon(history.boughtTotal)}원
          </p>
        </Card>
      </div>
      {/* 달을 바꾸면 필터를 '전체'로 되돌린다 */}
      <HistoryList key={history.ym} items={items} />
    </>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-12 w-36 rounded-xl bg-white" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-22 rounded-card bg-white" />
        <div className="h-22 rounded-card bg-white" />
      </div>
      <div className="h-11 rounded-full bg-soft" />
      <div className="h-48 rounded-card bg-white" />
    </div>
  )
}
