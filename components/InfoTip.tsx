'use client'

import { useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoInformationCircle } from 'react-icons/io5'

type Props = {
  /** 시트 제목. 보통 통 이름 */
  title: ReactNode
  /** 설명. 한 문장이 한 줄이다 */
  lines: string[]
}

/**
 * ⓘ 버튼. 누르면 화면 아래에서 설명 시트가 올라온다 (브라우저 내장 dialog).
 * 말풍선은 버튼 위치에 따라 화면 밖으로 잘려서 쓰지 않는다. 시트는 위치 계산이 없고,
 * 배경을 누르거나 Esc·닫기로 닫힌다. 제목 옆에 붙여서 쓴다.
 */
export function InfoTip({ title, lines }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  // dialog 는 <p> 안에 둘 수 없어서(제목 옆에 붙는다) body 로 보낸다. 서버 렌더링에선 document 가 없으니 클라이언트에서만
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  if (lines.length === 0) return null

  const sheet = (
    <dialog
      ref={ref}
      onClick={(e) => {
        // 배경(= dialog 자신)을 누르면 닫는다. 안쪽 요소를 누른 건 무시
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="info-sheet mx-auto mt-auto mb-0 w-full max-w-[430px] rounded-t-card border-0 bg-white p-0 text-ink open:animate-sheet motion-reduce:open:animate-none"
    >
      <div className="flex flex-col gap-3 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold">{title}</p>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => ref.current?.close()}
            className="flex size-8 items-center justify-center rounded-full text-lg text-muted active:bg-soft"
          >
            <IoClose aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </dialog>
  )

  return (
    <>
      <button
        type="button"
        aria-label="설명 보기"
        onClick={() => ref.current?.showModal()}
        className="ml-1 inline-flex size-5 shrink-0 items-center justify-center text-base leading-none text-muted active:text-deep"
      >
        <IoInformationCircle aria-hidden />
      </button>
      {mounted && createPortal(sheet, document.body)}
    </>
  )
}
