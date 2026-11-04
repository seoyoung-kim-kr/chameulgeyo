import { Suspense } from 'react'
import { shortDate, timeKst, todayKst } from '@/lib/cycle'
import { getHomeData } from '@/lib/queries'
import { HomeView } from './HomeView'

// 정적 셸 + 스트리밍. 세션·DB 는 <Suspense> 안의 HomeLoader 에서만 읽는다.
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeLoader />
    </Suspense>
  )
}

async function HomeLoader() {
  const { cycle, month, budget, heldTotal, isCutoff, cardStaleDays } = await getHomeData()
  const updated = month.cardUpdatedAt
  return (
    <HomeView
      ym={cycle.ym}
      cycleStart={cycle.start}
      cycleEnd={cycle.end}
      salary={month.salary}
      fixedTotal={month.fixed.reduce((acc, f) => acc + f.amount, 0)}
      cardBalance={month.cardBalance}
      cardUpdatedLabel={`${shortDate(todayKst(updated))} ${timeKst(updated)}`}
      cardStaleDays={cardStaleDays}
      cardConfirmedAmount={month.cardConfirmedAmount}
      isCutoff={isCutoff}
      available={budget.available}
      shopping={budget.shopping}
      shoppingRaw={budget.shoppingRaw}
      shoppingExhausted={budget.shoppingExhausted}
      shoppingBudgetStart={month.shoppingBudgetStart}
      livingNow={budget.livingNow}
      livingPerDay={budget.livingPerDay}
      emergencyAmount={month.emergencyAmount}
      heldTotal={heldTotal}
    />
  )
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5" aria-busy>
      <div className="mb-1 h-7 w-40 rounded-full bg-soft" />
      <div className="h-32 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
    </div>
  )
}
