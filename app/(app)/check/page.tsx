import Link from 'next/link'
import { Suspense } from 'react'
import { buttonClass } from '@/components/Button'
import { BottomActions, Card, Screen } from '@/components/Screen'
import { getHomeData } from '@/lib/queries'
import { CheckFlow } from './CheckFlow'

// 제목·닫기는 정적 셸, 쇼핑 예산은 <Suspense> 안에서 요청마다 읽는다.
export default function CheckPage() {
  return (
    <Screen
      title="사기 전에 확인"
      action={
        <Link href="/" className={buttonClass('text', 'h-8 px-2 text-sm')}>
          닫기
        </Link>
      }
    >
      <Suspense fallback={<CheckSkeleton />}>
        <CheckLoader />
      </Suspense>
    </Screen>
  )
}

async function CheckLoader() {
  const home = await getHomeData()
  if (!home) {
    return (
      <>
        <Card className="text-center text-sm text-muted">
          이번 달 예산이 아직 없어요.
          <br />
          설정을 먼저 해 주세요.
        </Card>
        <BottomActions>
          <Link href="/setup" className={buttonClass('primary')}>
            설정하기
          </Link>
        </BottomActions>
      </>
    )
  }
  const { budget, month, cycle, next, cashflow } = home
  return (
    <CheckFlow
      ctx={{
        shoppingRaw: budget.shoppingRaw,
        deferred: budget.deferred,
        livingTarget: month.livingTarget,
        emergencyAmount: month.emergencyAmount,
        cycleDays: cycle.days,
        nextCash: cashflow.nextCash,
        nextCycleDays: next.days,
      }}
    />
  )
}

function CheckSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-12 rounded-xl bg-white" />
      <div className="h-28 rounded-card bg-tint" />
      <div className="h-72 rounded-card bg-white" />
    </div>
  )
}
