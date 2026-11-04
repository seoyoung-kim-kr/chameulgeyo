'use client'

type Props = {
  value: string
  onChange: (value: string) => void
  maxLength: number
  /** 왼쪽 아래 칸에 둘 키. 가격 입력은 '000', PIN 은 없음 */
  extraKey?: '000'
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ value, onChange, maxLength, extraKey, disabled }: Props) {
  const append = (s: string) => {
    if (disabled) return
    const next = (value + s).replace(/^0+(?=\d)/, '').slice(0, maxLength)
    onChange(next)
  }
  const backspace = () => !disabled && onChange(value.slice(0, -1))

  const key = 'h-16 rounded-full text-2xl font-bold text-ink active:bg-soft disabled:opacity-40'

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
