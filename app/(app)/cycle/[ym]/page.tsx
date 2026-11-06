import clsx from 'clsx'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Bucket } from '@/components/Bucket'
import { buttonClass } from '@/components/Button'
import { BottomActions, Card, Screen } from '@/components/Screen'
import { shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { getPastCycle, type PastCycle } from '@/lib/queries'
import { EMERGENCY_DESC, MASK, Term, range, shoppingSub } from '../../HomeView'

// 지난 주기 보기 (읽기 전용). 이번 주기 홈(/)과 라우트를 나눈 이유: 홈은 설정 마법사·판정 진입이 걸려 있고
// Activity 로 보존되는 화면이라, 지난 주기 상태가 섞이지 않게 한다.
// ym 은 요청 시점 값이라 제목까지 <Suspense> 안에서 그린다 (generateStaticParams 없음).
export default function PastCyclePage({ params }: PageProps<'/cycle/[ym]'>) {
  return (
    <Suspense fallback={<PastSkeleton />}>
      <PastLoader params={params} />
    </Suspense>
  )
}

async function PastLoader({ params }: Pick<PageProps<'/cycle/[ym]'>, 'params'>) {
  const { ym } = await params
  const past = await getPastCycle(ym)
  if (!past) notFound()
  return <PastView p={past} />
}

const monthLabel = (ym: string) => `${Number(ym.slice(5))}월`

function PastView({ p }: { p: PastCycle }) {
  const { cycle, cashflow, budget, month } = p
  const hide = p.settings.hideAmounts
  const priv = (n: number) => (hide ? MASK : formatWon(n))
  const barPct = month.shoppingBudgetStart > 0 ? (budget.shopping / month.shoppingBudgetStart) * 100 : 0
  // 다음으로 갈 곳: 저장한 다음 주기가 이번 주기이거나 없으면 홈(이번 달)
  const toCurrent = cycle.ym !== p.currentYm && (p.nextYm === null || p.nextYm === p.currentYm)

  return (
    <Screen title={`${monthLabel(cycle.ym)} 지갑`} sub={range(cycle.start, cycle.end)}>
      <nav className="flex items-center justify-between text-sm" aria-label="다른 달">
        {p.prevYm ? (
          <Link href={`/cycle/${p.prevYm}`} className={buttonClass('text', 'h-8 px-2 text-sm')}>
            ‹ {monthLabel(p.prevYm)}
          </Link>
        ) : (
          <span />
        )}
        {toCurrent ? (
          <Link href="/" className={buttonClass('text', 'h-8 px-2 text-sm')}>
            이번 달 ›
          </Link>
        ) : p.nextYm && p.nextYm !== p.currentYm ? (
          <Link href={`/cycle/${p.nextYm}`} className={buttonClass('text', 'h-8 px-2 text-sm')}>
            {monthLabel(p.nextYm)} ›
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <Card aria-label="그 달 배분한 돈">
        <p className="text-sm text-muted">그 달 배분한 돈</p>
        <p className={clsx('mt-2 text-3xl font-bold', cashflow.cash < 0 ? 'text-red' : 'text-deep')}>
          {formatWon(cashflow.cash)}
          <span className="ml-0.5 text-base">원</span>
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-tint p-3 text-center">
          <Term label="월급" value={priv(month.salary)} />
          <Term label="계좌 고정지출" value={hide ? MASK : `−${formatWon(cashflow.fixed.cashOut)}`} />
          <Term
            label={cashflow.thisBill.dueDate ? `카드값 ${shortDate(cashflow.thisBill.dueDate)}` : '카드값'}
            value={hide ? MASK : `−${formatWon(cashflow.thisBill.fromCash)}`}
          />
        </dl>
      </Card>

      <Bucket
        highlight
        name="쇼핑 예산"
        amount={formatWon(budget.shoppingRaw)}
        amountTone={budget.shoppingExhausted ? 'red' : 'deep'}
        sub={shoppingSub(budget.shoppingRaw, budget.deferred)}
        subTone="red"
        bar={{ pct: barPct, label: '남은 쇼핑 예산' }}
      />
      <Bucket name="생활비" amount={formatWon(budget.livingNow)} sub={`하루 ${formatWon(budget.livingPerDay)}원`} />
      <Bucket tone="green" name="예비비" amount={formatWon(month.emergencyAmount)}>
        <p className="mt-2 text-xs text-muted">{EMERGENCY_DESC}</p>
      </Bucket>

      <p className="py-1 text-center text-sm text-muted">
        아낀 돈 <span className="font-bold text-green">+{formatWon(p.heldTotal)}원</span> · 산 돈{' '}
        <span className="font-bold text-red">
          {p.boughtKept > 0 ? '−' : ''}
          {formatWon(p.boughtKept)}원
        </span>
      </p>

      <BottomActions>
        <Link href={`/history?ym=${cycle.ym}`} className={buttonClass('soft')}>
          기록 보기
        </Link>
        <Link href="/" className={buttonClass('text', 'self-center')}>
          닫기
        </Link>
      </BottomActions>
    </Screen>
  )
}

function PastSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pt-5 pb-8" aria-busy>
      <div className="mb-3 h-8 w-40 rounded-full bg-soft" />
      <div className="h-8 rounded-full bg-white" />
      <div className="h-36 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
      <div className="h-20 rounded-card bg-white" />
    </div>
  )
}
