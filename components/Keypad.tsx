'use client'

import { useEffect } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  maxLength: number
  /** 왼쪽 아래 칸에 둘 키. 가격 입력은 '000', PIN 은 없음 */
  extraKey?: '000'
  /**
   * amount: 금액. 맨 앞의 0 을 지운다 ('0' → '5' 는 '5').
   * code: PIN 같은 숫자 코드. 0 으로 시작해도 그대로 둔다.
   */
  kind?: 'amount' | 'code'
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 입력칸·선택 상자에 포커스가 있으면 물리 키보드 입력을 가로채지 않는다 */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function Keypad({ value, onChange, maxLength, extraKey, kind = 'amount', disabled }: Props) {
  const append = (s: string) => {
    if (disabled) return
    const joined = value + s
    const next = (kind === 'amount' ? joined.replace(/^0+(?=\d)/, '') : joined).slice(0, maxLength)
    if (next !== value) onChange(next)
  }
  const backspace = () => {
    if (!disabled && value !== '') onChange(value.slice(0, -1))
  }

  // PC 키보드: 숫자(상단·넘패드)와 Backspace. 비활성(닫힌 시트 등)이면 듣지 않는다.
  // Activity 로 화면이 숨겨지면 effect 가 정리되므로 숨은 키패드는 입력을 받지 않는다.
  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTypingTarget(e.target)) return
      // 넘패드는 NumLock 이 꺼져 있으면 key 가 'End' 등으로 오므로 키 위치(code)로도 받는다
      const digit = /^[0-9]$/.test(e.key) ? e.key : /^Numpad[0-9]$/.test(e.code) ? e.code.slice(-1) : null
      if (digit) {
        e.preventDefault()
        append(digit)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const key =
    'h-16 select-none rounded-full text-2xl font-bold text-ink transition-colors hover:bg-tint active:bg-soft disabled:opacity-40 touch-manipulation'

  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="숫자 키패드">
      {DIGITS.map((d) => (
        <button key={d} type="button" className={key} onClick={() => append(d)} disabled={disabled} aria-label={d}>
          {d}
        </button>
      ))}
      {extraKey ? (
        <button type="button" className={key} onClick={() => append(extraKey)} disabled={disabled} aria-label={extraKey}>
          {extraKey}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className={key} onClick={() => append('0')} disabled={disabled} aria-label="0">
        0
      </button>
      <button type="button" className={key} onClick={backspace} disabled={disabled} aria-label="지우기">
        ⌫
      </button>
    </div>
  )
}
