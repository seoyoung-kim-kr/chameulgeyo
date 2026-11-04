'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Bucket } from '@/components/Bucket'
import { buttonClass } from '@/components/Button'
import { CardBalanceSheet } from '@/components/CardBalanceSheet'
import { Chip } from '@/components/Chip'
import { BottomActions, Card, Screen } from '@/components/Screen'
import { shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'

/** 카드값을 이만큼 안 적으면 확인하라고 알린다 */
const STALE_DAYS = 3

export type HomeViewProps = {
  ym: string
  cycleStart: string
  cycleEnd: string
  salary: number
  fixedTotal: number
  cardBalance: number
  /** 'M/D HH:mm' (KST) */
  cardUpdatedLabel: string
  cardStaleDays: number
  cardConfirmedAmount: number | null
  isCutoff: boolean
  available: number
  shopping: number
  shoppingRaw: number
  shoppingExhausted: boolean
  shoppingBudgetStart: number
  livingNow: number
  livingPerDay: number
  emergencyAmount: number
  heldTotal: number
}

export function HomeView(p: HomeViewProps) {
  const [sheet, setSheet] = useState<null | 'update' | 'confirm'>(null)
  const closeSheet = useCallback(() => setSheet(null), [])

  const stale = p.cardStaleDays >= STALE_DAYS
  // 이번 달 처음 정한 쇼핑 예산 중 얼마나 남았는지
  const barPct = p.shoppingBudgetStart > 0 ? (p.shopping / p.shoppingBudgetStart) * 100 : 0

  return (
    <Screen
      title={`${Number(p.ym.slice(5))}월 지갑`}
      sub={`${shortDate(p.cycleStart)}~${shortDate(p.cycleEnd)}`}
      action={
        <Chip variant={stale ? 'solid' : 'ghost'} className={clsx(stale && 'text-red')} onClick={() => setSheet('update')}>
          {stale ? '카드값 확인 필요' : '카드값 입력'}
        </Chip>
      }
    >
      {p.isCutoff && (
        <button type="button" onClick={() => setSheet('confirm')} className="rounded-card bg-soft p-4 text-left text-sm text-deep active:opacity-80">
          <span className="block font-bold">오늘은 카드값 확정일이에요.</span>
          <span className="block">확정된 금액을 입력해 주세요.</span>
        </button>
      )}

      <Card aria-label="다음 달 쓸 수 있는 돈">
        <p className="text-sm text-muted">다음 달 쓸 수 있는 돈</p>
        <p className={clsx('mt-2 text-3xl font-bold', p.available < 0 ? 'text-red' : 'text-deep')}>
          {formatWon(p.available)}
          <span className="ml-0.5 text-base">원</span>
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-tint p-3 text-center">
          <Term label="월급" value={formatWon(p.salary)} />
          <Term label="고정지출" value={`−${formatWon(p.fixedTotal)}`} />
          <Term label="카드값" value={`−${formatWon(p.cardBalance)}`} />
        </dl>
        <p className={clsx('mt-3 text-xs', stale ? 'text-red' : 'text-muted')}>카드값 입력 {p.cardUpdatedLabel}</p>
        {p.cardConfirmedAmount !== null && (
          <p className="mt-1 text-xs text-deep">다음 월급에서 {formatWon(p.cardConfirmedAmount)}원이 빠져나가요.</p>
        )}
      </Card>

      <Bucket
        highlight
        name="쇼핑 예산"
        amount={formatWon(p.shopping)}
        amountTone={p.shoppingExhausted ? 'red' : 'deep'}
        sub={p.shoppingExhausted ? `생활비 ${formatWon(-p.shoppingRaw)}원 부족` : undefined}
        subTone="red"
        bar={{ pct: barPct, label: '남은 쇼핑 예산' }}
      />
      <Bucket name="생활비" amount={formatWon(p.livingNow)} sub={`하루 ${formatWon(p.livingPerDay)}원`} />
      <Bucket tone="green" name="비상금" amount={formatWon(p.emergencyAmount)} />

      <p className="py-1 text-center text-sm text-muted">
        이번 달 아낀 돈 <span className="font-bold text-green">+{formatWon(p.heldTotal)}원</span>
      </p>

      <BottomActions>
        <Link href="/check" className={buttonClass('primary')}>
          사기 전에 확인하기
        </Link>
        <div className="flex justify-center gap-2">
          <Link href="/history" className={buttonClass('text')}>
            기록
          </Link>
          <Link href="/setup" className={buttonClass('text')}>
            설정
          </Link>
        </div>
      </BottomActions>

      <CardBalanceSheet open={sheet !== null} onClose={closeSheet} current={p.cardBalance} confirmMode={sheet === 'confirm'} />
    </Screen>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold">{value}</dd>
    </div>
  )
}
