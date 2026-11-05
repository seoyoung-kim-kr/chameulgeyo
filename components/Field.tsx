'use client'

import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { formatWon } from '@/lib/format'
import { AMOUNT_MAX } from '@/lib/validation'

/** 입력 상자 공통 모양: 높이 48, 테두리, 포커스 시 핑크 테두리 */
const BOX = 'flex h-12 items-center gap-1 rounded-xl border border-line bg-white px-3 focus-within:border-pink'

/** 라벨 + 입력. 라벨과 입력 상자 사이 8. */
export function Field({ label, aside, children }: { label: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm text-muted">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  )
}

type MoneyInputProps = {
  value: number
  onChange: (value: number) => void
  /** 화면에 라벨이 따로 없을 때 스크린리더용 이름 */
  label: string
  className?: string
}

/** 금액 입력 상자. 화면엔 콤마를 찍고 값은 정수로 돌려준다. 오른쪽 정렬 + '원'. */
export function MoneyInput({ value, onChange, label, className }: MoneyInputProps) {
  return (
    <span className={clsx(BOX, className)}>
      <input
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        className="w-full min-w-0 bg-transparent text-right text-base font-bold outline-none placeholder:font-normal placeholder:text-muted/50"
        placeholder="0"
        value={value === 0 ? '' : formatWon(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
          onChange(Math.min(Number(digits || '0'), AMOUNT_MAX))
        }}
      />
      <span className="shrink-0 text-sm text-muted">원</span>
    </span>
  )
}

/**
 * 날짜 입력 상자. 다른 입력과 같은 테두리 상자 안에 넣는다.
 * iOS Safari 의 type="date" 는 고유 최소 너비로 상자 밖으로 삐져나오고, 값을 가운데 정렬하며,
 * 높이를 무시하고, 값이 비면 높이가 줄어든다. appearance·min-w-0·전역 CSS(globals.css)로 맞춘다.
 */
export function DateInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    // overflow-hidden: iOS 버전에 따라 min-w-0 이 안 먹어도 상자 밖으로 그려지지 않게 자른다
    <span className={clsx(BOX, 'min-w-0 overflow-hidden', className)}>
      <input
        type="date"
        className="date-input block h-full w-full min-w-0 appearance-none bg-transparent text-left text-base outline-none"
        {...rest}
      />
    </span>
  )
}

/** 글자 입력 상자 (항목 이름, 상품 이름) */
export function TextInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <span className={clsx(BOX, invalid && 'border-red', className)}>
      <input
        autoComplete="off"
        className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted/50"
        {...rest}
      />
    </span>
  )
}
