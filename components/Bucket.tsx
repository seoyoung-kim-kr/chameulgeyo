import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'pink' | 'green'

type Props = {
  tone?: Tone
  /** 기본은 하트 */
  icon?: ReactNode
  name: ReactNode
  desc?: ReactNode
  /** 금액 자리. 숫자면 그대로, 입력칸 같은 노드도 받는다 */
  amount: ReactNode
  amountTone?: 'ink' | 'deep' | 'red' | 'green'
  /** 진행 바 (0~100) */
  bar?: { pct: number }
  /** 강조 배경 (쇼핑 통) */
  highlight?: boolean
}

const AMOUNT_TONES = { ink: 'text-ink', deep: 'text-deep', red: 'text-red', green: 'text-green' }

/** 돈 통 한 줄: 아이콘 · 이름/설명 · 금액 */
export function Bucket({ tone = 'pink', icon, name, desc, amount, amountTone = 'ink', bar, highlight }: Props) {
  return (
    <div className={clsx('rounded-card border border-line px-4 py-4', highlight ? 'bg-tint' : 'bg-white')}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={clsx(
            'flex size-9 shrink-0 items-center justify-center rounded-xl text-lg',
            tone === 'pink' ? 'bg-soft text-deep' : 'bg-green-soft text-green',
          )}
        >
          {icon ?? '♥'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{name}</p>
          {desc && <p className="text-xs text-muted">{desc}</p>}
        </div>
        <div className={clsx('shrink-0 text-right text-lg font-bold', AMOUNT_TONES[amountTone])}>{amount}</div>
      </div>
      {bar && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-pink" style={{ width: `${Math.min(Math.max(bar.pct, 0), 100)}%` }} />
        </div>
      )}
    </div>
  )
}
