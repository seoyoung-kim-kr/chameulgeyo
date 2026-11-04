'use client'

import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useState, useTransition } from 'react'
import { updateCardBalance } from '@/app/(app)/card/actions'
import { formatWon } from '@/lib/format'
import { AMOUNT_MAX } from '@/lib/validation'
import { Button } from './Button'
import { Keypad } from './Keypad'
import { BottomActions, Message } from './Screen'

type Props = {
  open: boolean
  onClose: () => void
  /** 지금 저장된 카드값 */
  current: number
  /** 확정일 모드: 제목이 바뀌고 card_confirmed_amount 에도 저장한다 */
  confirmMode: boolean
}

const MAX_DIGITS = String(AMOUNT_MAX).length

const ERRORS: Record<string, string> = {
  INVALID: '금액을 다시 확인해 주세요.',
  NO_MONTH: '이번 달 설정이 없어요.',
  DB: '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.',
}

/** 카드사 앱의 이용금액 한 숫자를 옮겨 적는 바텀시트. 키패드는 로그인·가격 입력과 같은 것을 쓴다. */
export function CardBalanceSheet({ open, onClose, current, confirmMode }: Props) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Activity 로 화면이 숨겨질 때 열린 채 남지 않게 닫는다 (next 문서 preserving-ui-state)
  useLayoutEffect(() => () => onClose(), [onClose])

  const amount = Number(value || '0')
  const changed = value !== '' && amount !== current

  const close = () => {
    setValue('')
    setError(null)
    onClose()
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateCardBalance({ amount, confirm: confirmMode })
      if (!result.ok) {
        if (result.error === 'UNAUTHORIZED') return router.replace('/login')
        setError(ERRORS[result.error] ?? ERRORS.DB)
        return
      }
      close()
    })
  }

  return (
    <>
      <div
        aria-hidden
        onClick={pending ? undefined : close}
        className={clsx(
          'fixed inset-0 z-10 bg-ink/30 transition-opacity motion-reduce:transition-none md:absolute',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-sheet-title"
        aria-hidden={!open}
        className={clsx(
          'fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-[28px] bg-white px-5 pt-3 pb-8 shadow-[0_-8px_30px_rgba(201,56,107,.12)] transition-transform duration-300 motion-reduce:transition-none md:absolute',
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
        <div className="flex h-8 items-center">
          <h2 id="card-sheet-title" className="text-xl font-bold">
            {confirmMode ? '확정된 카드값' : '현재 카드값'}
          </h2>
        </div>

        <p className="text-right text-3xl font-bold text-deep" aria-live="polite">
          {value === '' ? <span className="text-line">{formatWon(current)}</span> : formatWon(amount)}
          <span className="ml-1 text-base font-normal text-muted">원</span>
        </p>

        <Keypad value={value} onChange={setValue} maxLength={MAX_DIGITS} extraKey="000" disabled={pending || !open} />

        <BottomActions>
          <Message>{error && <span className="whitespace-pre-line">{error}</span>}</Message>
          <Button onClick={save} disabled={!changed || pending}>
            {pending ? '저장 중…' : '저장'}
          </Button>
          <Button variant="text" onClick={close} disabled={pending}>
            취소
          </Button>
        </BottomActions>
      </section>
    </>
  )
}
