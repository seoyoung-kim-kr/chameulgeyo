'use client'

import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useToast } from '@/components/Toast'
import { formatWon } from '@/lib/format'
import { cancelPurchase } from './actions'

export type HistoryItem = {
  id: string
  name: string | null
  price: number
  verdict: 'red' | 'green'
  choice: 'held' | 'bought'
  overAmount: number
  /** 'M/D' (KST) */
  date: string
  /** 환불·취소한 기록이면 환불액을 뺀 대금 출금일('M/D')과 청구 전 취소 여부 */
  refund: { due: string | null; beforeBilling: boolean } | null
}

type Filter = 'all' | 'held' | 'bought'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'held', label: '안 샀어요' },
  { value: 'bought', label: '샀어요' },
]

const EMPTY: Record<Filter, string> = {
  all: '아직 기록이 없어요.',
  held: '안 산 기록이 없어요.',
  bought: '산 기록이 없어요.',
}

/** 월 선택. 바꾸면 주소의 ?ym= 을 바꿔 서버에서 그 달 기록을 다시 받는다. */
export function MonthSelect({ value, options }: { value: string; options: string[] }) {
  const router = useRouter()
  return (
    <select
      aria-label="월 선택"
      value={value}
      onChange={(e) => router.replace(`/history?ym=${e.target.value}`)}
      className="h-12 self-start rounded-xl border border-line bg-white px-3 text-base font-bold text-deep outline-none focus:border-pink"
    >
      {options.map((ym) => (
        <option key={ym} value={ym}>
          {ym.slice(0, 4)}년 {Number(ym.slice(5))}월
        </option>
      ))}
    </select>
  )
}

/** 전체 / 안 샀어요 / 샀어요 필터와 목록. 필터는 이 화면 안의 상태라 서버에 다시 묻지 않는다. */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = filter === 'all' ? items : items.filter((d) => d.choice === filter)
  const count = (f: Filter) => (f === 'all' ? items.length : items.filter((d) => d.choice === f).length)

  return (
    <section aria-label="기록 목록" className="flex flex-col gap-3">
      <div role="tablist" aria-label="기록 필터" className="flex gap-1 rounded-full bg-soft p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              'h-9 flex-1 rounded-full text-sm transition-colors',
              filter === f.value ? 'bg-white font-bold text-deep shadow-sm' : 'text-muted active:text-ink',
            )}
          >
            {f.label} <span className="text-xs font-normal">{count(f.value)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">{EMPTY[filter]}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-white px-4">
          {shown.map((d) => (
            <HistoryRow key={d.id} item={d} />
          ))}
        </ul>
      )}
    </section>
  )
}

const CANCEL_ERRORS: Record<string, string> = {
  NOT_FOUND: '기록을 찾지 못했어요.',
  NOT_BOUGHT: '산 기록만 취소할 수 있어요.',
  DB: '취소하지 못했어요. 잠시 후 다시 시도해 주세요.',
}

/** 기록 한 줄. 산 기록은 환불·취소할 수 있고, 한 번 더 확인한다. */
function HistoryRow({ item: d }: { item: HistoryItem }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const held = d.choice === 'held'
  const canceled = d.refund !== null

  const cancel = () => {
    setError(null)
    startTransition(async () => {
      const res = await cancelPurchase(d.id)
      if (!res.ok) {
        if (res.error === 'UNAUTHORIZED') return router.replace('/login')
        setError(CANCEL_ERRORS[res.error] ?? CANCEL_ERRORS.DB)
        return
      }
      setConfirming(false)
      toast(`${formatWon(d.price)}원을 환불로 처리했어요`)
    })
  }

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={clsx('size-2.5 shrink-0 rounded-full', held ? 'bg-green' : canceled ? 'bg-line' : 'bg-red')} />
        <div className="min-w-0 flex-1">
          <p className={clsx('truncate font-bold', !d.name && 'font-normal text-muted', canceled && 'text-muted')}>{d.name ?? '이름 없음'}</p>
          <p className="mt-1 text-xs text-muted">
            {d.date} · {d.verdict === 'red' ? `예산 ${formatWon(d.overAmount)}원 초과` : '예산 안'}
          </p>
          {d.refund && (
            <p className="mt-1 text-xs text-muted">
              환불됨 · {d.refund.due ? `${d.refund.due} 카드값에서 빠져요` : '카드값에서 빠져요'}
            </p>
          )}
        </div>
        <p className={clsx('shrink-0 font-bold', held ? 'text-green' : canceled ? 'text-muted line-through' : 'text-red')}>
          <span className="sr-only">{held ? '안 샀어요' : canceled ? '환불됨' : '샀어요'} </span>
          {held ? '+' : '−'}
          {formatWon(d.price)}
        </p>
      </div>

      {!held && !canceled && (
        <div className="flex items-center justify-end gap-2 text-xs">
          {confirming ? (
            <>
              <span className="mr-auto text-muted">카드값에서 {formatWon(d.price)}원을 빼요.</span>
              <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="h-8 rounded-full px-3 text-muted active:bg-soft">
                아니요
              </button>
              <button type="button" onClick={cancel} disabled={pending} className="h-8 rounded-full bg-soft px-3 font-bold text-deep active:opacity-70 disabled:opacity-40">
                {pending ? '처리 중…' : '환불·취소하기'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="h-8 rounded-full border border-line px-3 text-muted active:bg-soft">
              환불·취소
            </button>
          )}
        </div>
      )}
      {error && <p className="text-right text-xs text-red">{error}</p>}
    </li>
  )
}
