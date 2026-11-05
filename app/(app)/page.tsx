import { Suspense } from 'react'
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
  const { cycle, next, month, cashflow, budget } = home
  return (
    <HomeView
      ym={cycle.ym}
      cycleStart={cycle.start}
      cycleEnd={cycle.end}
      nextStart={next.start}
      nextEnd={next.end}
      salary={month.salary}
      fixedCashOut={cashflow.fixed.cashOut}
      fixedCard={cashflow.fixed.card}
      unclassifiedCount={cashflow.fixed.unclassifiedCount}
      thisBill={cashflow.thisBill}
      nextBill={cashflow.nextBill}
      nextBillStaleDays={home.nextBillStaleDays}
      isCutoff={home.isCutoff}
      cash={cashflow.cash}
      nextCash={cashflow.nextCash}
      shopping={budget.shopping}
      shoppingRaw={budget.shoppingRaw}
      shoppingExhausted={budget.shoppingExhausted}
      shoppingBudgetStart={month.shoppingBudgetStart}
      boughtTotal={home.boughtTotal}
      livingNow={budget.livingNow}
      livingPerDay={budget.livingPerDay}
      emergencyAmount={month.emergencyAmount}
      heldTotal={home.heldTotal}
      hideAmounts={home.settings.hideAmounts}
      previousYm={home.previousYm}
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
