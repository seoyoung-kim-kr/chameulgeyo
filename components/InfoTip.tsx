'use client'

import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'
import { IoInformationCircle } from 'react-icons/io5'

/** 말풍선 폭 (w-64) + 화면 가장자리 여백 */
const PANEL_WIDTH = 256
const EDGE = 16

type Props = {
  /** 설명. 한 문장이 한 줄이다 */
  lines: string[]
  /** 스크린리더용 이름. "쇼핑 예산 설명" 처럼 */
  label: string
}

/**
 * ⓘ 버튼. 누르면 바로 아래에 설명 말풍선이 열린다 (폭 고정, 오른쪽에 공간이 없으면 오른쪽 끝 맞춤).
 * 제목 옆에 붙여서 쓴다. 바깥을 누르거나 Esc 로 닫는다.
 */
export function InfoTip({ lines, label }: Props) {
  const [open, setOpen] = useState(false)
  /** 버튼이 오른쪽에 있으면 말풍선을 오른쪽 끝에 맞춰 화면 밖으로 안 나가게 한다 */
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  const toggle = () => {
    const el = ref.current
    if (el) {
      // 데스크톱에선 폰 프레임(data-frame) 안에서 잘리므로 프레임의 오른쪽 끝을 기준으로 잰다
      const frame = el.closest('[data-frame]')?.getBoundingClientRect()
      const rightEdge = (frame ? frame.right : window.innerWidth) - EDGE
      setAlignRight(el.getBoundingClientRect().left + PANEL_WIDTH > rightEdge)
    }
    setOpen((v) => !v)
  }

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
        onClick={toggle}
        className="flex size-5 items-center justify-center text-base text-muted active:text-deep"
      >
        <IoInformationCircle aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={clsx(
            'absolute top-full z-10 mt-1 flex w-64 flex-col gap-1 rounded-xl border border-line bg-white p-3 text-left text-xs font-normal text-ink shadow-[0_8px_24px_rgba(0,0,0,.08)]',
            alignRight ? 'right-0' : 'left-0',
          )}
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
