import { Suspense } from 'react'
import { shortDate, timeKst, todayKst } from '@/lib/cycle'
import { getHomeData } from '@/lib/queries'
import { HomeView } from './HomeView'
import { SetupLoader } from './setup/SetupLoader'

// 정적 셸 + 스트리밍. 세션·DB 는 <Suspense> 안의 HomeLoader 에서만 읽는다.
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeLoader />
    </Suspense>
  )
}

async function HomeLoader() {
  const home = await getHomeData()
  // 이번 주기 설정 전이면 홈 자리에서 바로 설정한다 (redirect 하지 않는 이유는 getHomeData 주석)
  if (!home) return <SetupLoader />
  const { cycle, month, budget, heldTotal, isCutoff, cardStaleDays } = home
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
    <div className="flex flex-1 flex-col gap-3 px-5 pt-5 pb-8" aria-busy>
      <div className="mb-3 h-8 w-40 rounded-full bg-soft" />
      <div className="h-36 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
    </div>
  )
}
