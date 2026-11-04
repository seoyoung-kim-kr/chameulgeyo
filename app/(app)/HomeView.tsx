'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Bucket } from '@/components/Bucket'
import { buttonClass } from '@/components/Button'
import { CardBalanceSheet } from '@/components/CardBalanceSheet'
import { Chip } from '@/components/Chip'
import { shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'

/** 카드값을 이만큼 안 옮겨 적으면 "오래됐어요" 경고 */
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

  const month = Number(p.ym.slice(5))
  const stale = p.cardStaleDays >= STALE_DAYS
  const barPct = p.shoppingBudgetStart > 0 ? (p.shopping / p.shoppingBudgetStart) * 100 : 0

  return (
    <main className="flex min-h-[calc(100dvh-12px)] flex-col px-5 pt-5 pb-8 md:min-h-[832px]">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <span className="text-pink">♡</span> {month}월 지갑
          <span className="ml-2 text-sm font-normal text-muted">
            {shortDate(p.cycleStart)}~{shortDate(p.cycleEnd)}
          </span>
        </h1>
        <Chip variant={stale ? 'solid' : 'ghost'} className={clsx(stale && 'text-red')} onClick={() => setSheet('update')}>
          {stale ? '카드값이 오래됐어요' : '카드값 갱신'}
        </Chip>
      </header>

      {p.isCutoff && (
        <button
          type="button"
          onClick={() => setSheet('confirm')}
          className="mb-3 w-full rounded-card bg-soft px-4 py-3 text-left text-sm text-deep active:opacity-80"
        >
          <span className="font-bold">오늘 카드값 확정일</span> · 카드 앱의 확정 금액을 적어 주세요
        </button>
      )}

      <section className="rounded-card border border-line bg-white px-4 py-4" aria-label="다음 달 쓸 수 있는 돈">
        <p className="text-xs text-muted">다음 달 쓸 수 있는 돈</p>
        <p className={clsx('text-3xl font-bold', p.available < 0 ? 'text-red' : 'text-deep')}>
          {formatWon(p.available)}
          <span className="text-base">원</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>월급 {formatWon(p.salary)}</Chip>
          <Chip>고정 −{formatWon(p.fixedTotal)}</Chip>
          <Chip>카드 −{formatWon(p.cardBalance)}</Chip>
        </div>
        <p className={clsx('mt-2 text-xs', stale ? 'text-red' : 'text-muted')}>카드값 마지막 갱신 · {p.cardUpdatedLabel}</p>
        {p.cardConfirmedAmount !== null && (
          <p className="mt-1 text-xs text-deep">다음 월급에서 {formatWon(p.cardConfirmedAmount)}원 빠져나가요</p>
        )}
      </section>

      <div className="mt-3 flex flex-col gap-2">
        <Bucket
          highlight
          name="쇼핑 가능"
          desc={
            p.shoppingExhausted ? (
              <span className="text-red">이번 달은 쇼핑 없음 · 생활비가 {formatWon(-p.shoppingRaw)}원 모자라요</span>
            ) : (
              `월초 ${formatWon(p.shoppingBudgetStart)} → 지금`
            )
          }
          amount={formatWon(p.shopping)}
          amountTone={p.shoppingExhausted ? 'red' : 'deep'}
          bar={{ pct: barPct }}
        />
        <Bucket name="생활비 지킬 선" desc={`하루 ${formatWon(p.livingPerDay)}원`} amount={formatWon(p.livingNow)} />
        <Bucket tone="green" name="비상금" desc="매달 떼어두는 돈" amount={formatWon(p.emergencyAmount)} />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        이번 달 참은 돈 <span className="font-bold text-green">+{formatWon(p.heldTotal)}</span>
      </p>

      <div className="mt-auto flex flex-col items-center gap-3 pt-6">
        <Link href="/check" className={buttonClass('primary')}>
          사고 싶은 게 생겼어요 ♡
        </Link>
        <div className="flex gap-6 text-sm text-muted">
          <Link href="/history" className="active:text-ink">
            기록 보기
          </Link>
          <Link href="/setup" className="active:text-ink">
            설정
          </Link>
        </div>
      </div>

      <CardBalanceSheet open={sheet !== null} onClose={closeSheet} current={p.cardBalance} confirmMode={sheet === 'confirm'} />
    </main>
  )
}
