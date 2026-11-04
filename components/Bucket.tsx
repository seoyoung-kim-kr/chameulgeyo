import clsx from 'clsx'
import type { ReactNode } from 'react'

type Props = {
  tone?: 'pink' | 'green'
  name: ReactNode
  /** 오른쪽 금액. 문자열이나 입력 상자 */
  amount: ReactNode
  amountTone?: 'ink' | 'deep' | 'red' | 'green'
  /** 금액 아래 작은 글씨 (하루 환산 등) */
  sub?: ReactNode
  subTone?: 'muted' | 'red'
  /** 진행 바 (0~100) */
  bar?: { pct: number; label: string }
  highlight?: boolean
  children?: ReactNode
}

const AMOUNT_TONES = { ink: 'text-ink', deep: 'text-deep', red: 'text-red', green: 'text-green' }

/** 돈 통 한 장: 아이콘 · 이름 · 금액(+ 아래 작은 글씨). 카드 규칙(안쪽 16)을 따른다. */
export function Bucket({ tone = 'pink', name, amount, amountTone = 'ink', sub, subTone = 'muted', bar, highlight, children }: Props) {
  return (
    <section className={clsx('rounded-card p-4', highlight ? 'bg-tint' : 'border border-line bg-white')}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={clsx(
            'flex size-9 shrink-0 items-center justify-center rounded-xl text-lg',
            tone === 'pink' ? 'bg-soft text-deep' : 'bg-green-soft text-green',
          )}
        >
          ♥
        </span>
        <p className="min-w-0 flex-1 font-bold">{name}</p>
        <div className="shrink-0 text-right">
          <div className={clsx('text-lg font-bold', AMOUNT_TONES[amountTone])}>{amount}</div>
          {sub && <p className={clsx('text-xs', subTone === 'red' ? 'text-red' : 'text-muted')}>{sub}</p>}
        </div>
      </div>
      {bar && (
        <div
          role="progressbar"
          aria-label={bar.label}
          aria-valuenow={Math.round(bar.pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-soft"
        >
          <div className="h-full rounded-full bg-pink" style={{ width: `${Math.min(Math.max(bar.pct, 0), 100)}%` }} />
        </div>
      )}
      {children}
    </section>
  )
}
