import Link from 'next/link'
import { Suspense } from 'react'
import { buttonClass } from '@/components/Button'
import { BottomActions, Card, Screen } from '@/components/Screen'
import { cardDueDate } from '@/lib/cycle'
import { getCardBills } from '@/lib/queries'
import { CardForm } from './CardForm'

// 제목·닫기는 정적 셸, 대금은 <Suspense> 안에서 요청마다 읽는다.
export default function CardPage() {
  return (
    <Screen
      title="카드값"
      action={
        <Link href="/" className={buttonClass('text', 'h-8 px-2 text-sm')}>
          닫기
        </Link>
      }
    >
      <Suspense fallback={<CardSkeleton />}>
        <CardLoader />
      </Suspense>
    </Screen>
  )
}

async function CardLoader() {
  const data = await getCardBills()
  if (!data) {
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
  const { cycle, next, settings, thisBill, nextBill, cardFixed } = data
  const t = { dueDate: thisBill?.dueDate ?? cardDueDate(cycle, settings.cardPayDay), amount: thisBill?.amount ?? 0, paid: !!thisBill && thisBill.paidAmount >= thisBill.amount && thisBill.amount > 0 }
  const n = { dueDate: nextBill?.dueDate ?? cardDueDate(next, settings.cardPayDay), amount: nextBill?.amount ?? 0, includesCardFixed: nextBill?.includesCardFixed ?? true }
  // 저장 후 서버 값이 바뀌면 폼을 새로 마운트해 입력 상태를 맞춘다
  return <CardForm key={JSON.stringify([t, n])} cycle={cycle} next={next} thisBill={t} nextBill={n} cardFixed={cardFixed} />
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-64 rounded-card bg-white" />
      <div className="h-64 rounded-card bg-white" />
    </div>
  )
}
