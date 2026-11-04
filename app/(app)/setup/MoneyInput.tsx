'use client'

import clsx from 'clsx'
import { formatWon } from '@/lib/format'
import { AMOUNT_MAX } from '@/lib/validation'

type Props = {
  value: number
  onChange: (value: number) => void
  label: string
  className?: string
  /** 원 단위 표시 */
  suffix?: boolean
}

/** 숫자만 받는 금액 칸. 화면에는 콤마를 찍고 값은 정수로 돌려준다. */
export function MoneyInput({ value, onChange, label, className, suffix = true }: Props) {
  return (
    <span className={clsx('inline-flex items-baseline gap-1', className)}>
      <input
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        className="w-full min-w-0 bg-transparent text-right font-bold outline-none placeholder:text-line"
        placeholder="0"
        value={value === 0 ? '' : formatWon(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
          onChange(Math.min(Number(digits || '0'), AMOUNT_MAX))
        }}
      />
      {suffix && <span className="text-xs font-normal text-muted">원</span>}
    </span>
  )
}
