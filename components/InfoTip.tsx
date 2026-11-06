'use client'

import { useEffect, useId, useRef, useState } from 'react'

type Props = {
  /** 설명. 한 문장이 한 줄이다 */
  lines: string[]
  /** 스크린리더용 이름. "쇼핑 예산 설명" 처럼 */
  label: string
}

/**
 * ⓘ 버튼. 누르면 바로 아래에 설명 말풍선이 열린다 (왼쪽 정렬, 폰 너비 안에 들어오게 폭 고정).
 * 제목 옆에 붙여서 쓴다. 바깥을 누르거나 Esc 로 닫는다.
 */
export function InfoTip({ lines, label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (lines.length === 0) return null

  return (
    <span ref={ref} className="relative ml-1 inline-block align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex size-5 items-center justify-center rounded-full border border-line text-[11px] leading-none text-muted active:bg-soft"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute top-full left-0 z-10 mt-1 flex w-64 flex-col gap-1 rounded-xl border border-line bg-white p-3 text-left text-xs font-normal text-ink shadow-[0_8px_24px_rgba(0,0,0,.08)]"
        >
          {lines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
