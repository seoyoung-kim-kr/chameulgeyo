'use client'

import clsx from 'clsx'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useState, useTransition, type FormEvent } from 'react'
import { buttonClass } from '@/components/Button'
import { Keypad } from '@/components/Keypad'
import { TrafficLight } from '@/components/TrafficLight'
import { useToast } from '@/components/Toast'
import { decisionFor, isValidPrice, PRICE_MAX, type DecideResult } from '@/lib/budget'
import { formatWon } from '@/lib/format'
import { DECISION_NAME_MAX } from '@/lib/validation'
import { choose, decide } from './actions'

type Props = { shoppingRaw: number; livingTarget: number; cycleDays: number }

const PRICE_DIGITS = String(PRICE_MAX).length

const ERRORS: Record<string, string> = {
  INVALID: '입력값을 다시 확인해 주세요',
  INVALID_PRICE: '가격은 1원부터 1억 원까지 넣을 수 있어요',
  DB: '저장하지 못했어요. 잠시 후 다시 시도해 주세요',
}

/** 가격 입력 → 판정 → 선택. 판정은 같은 순수 함수로 즉시 미리 보여주고 서버 응답으로 교체한다. */
export function CheckFlow({ shoppingRaw, livingTarget, cycleDays }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<'input' | 'verdict'>('input')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<DecideResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  /** 판정 하나에 id 하나. 더블탭·재시도에도 같은 id 로 choose 해서 한 번만 기록된다 */
  const [decisionId, setDecisionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const price = Number(value || '0')
  const canJudge = isValidPrice(price) && !pending
  const shopping = Math.max(shoppingRaw, 0)

  const reset = () => {
    setStep('input')
    setName('')
    setValue('')
    setResult(null)
    setConfirmed(false)
    setDecisionId('')
    setError(null)
  }

  // Activity 로 /check 가 숨겨질 때(닫기·뒤로 가기·홈 이동) 지난 판정이 남지 않게 처음으로 되돌린다
  useLayoutEffect(() => () => reset(), [])

  const handleError = (code: string) => {
    if (code === 'UNAUTHORIZED') return router.replace('/login')
    if (code === 'NO_MONTH') return router.replace('/setup')
    setError(ERRORS[code] ?? ERRORS.DB)
  }

  const judgeNow = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canJudge) return
    setError(null)
    setResult(decisionFor(price, { shoppingRaw, livingTarget, cycleDays }))
    setConfirmed(false)
    setDecisionId(nanoid())
    setStep('verdict')
    startTransition(async () => {
      const res = await decide(price)
      if (!res.ok) return handleError(res.error)
      setResult(res.data)
      setConfirmed(true)
    })
  }

  const pick = (choice: 'held' | 'bought') => {
    if (!result || pending) return
    setError(null)
    startTransition(async () => {
      const res = await choose({ id: decisionId, name: name.trim() || null, price: result.price, choice })
      if (!res.ok) return handleError(res.error)
      toast(choice === 'held' ? `${formatWon(result.price)}원 지켰어요 ♡` : `카드값에 ${formatWon(result.price)}원 더했어요`)
      reset()
      router.push('/')
    })
  }

  if (step === 'verdict' && result) {
    return (
      <div className="flex flex-1 flex-col">
        <TrafficLight
          result={result}
          productName={name}
          pending={pending}
          confirmed={confirmed}
          onHold={() => pick('held')}
          onBuy={() => pick('bought')}
        />
        <p className="mt-2 h-5 text-center text-sm text-red" aria-live="polite">
          {error ?? ''}
        </p>
        <button type="button" className="mt-1 self-center text-sm text-muted active:text-ink disabled:opacity-40" onClick={() => setStep('input')} disabled={pending}>
          가격 다시 입력
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={judgeNow} className="flex flex-1 flex-col">
      <input
        aria-label="상품명 (선택)"
        placeholder="상품명 (선택)"
        maxLength={DECISION_NAME_MAX}
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-card border border-line bg-white px-4 outline-none placeholder:text-muted/60 focus:border-pink"
      />

      <div className="mt-6 text-center">
        <p className="text-sm text-muted">얼마예요?</p>
        <p className={clsx('mt-1 text-4xl font-bold', value === '' ? 'text-line' : 'text-deep')} aria-live="polite">
          {formatWon(price)}
          <span className="ml-1 text-lg font-normal text-muted">원</span>
        </p>
        <p className={clsx('mt-2 text-xs', shoppingRaw < 0 ? 'text-red' : 'text-muted')}>
          {shoppingRaw < 0 ? '이번 달은 쇼핑 없음 · 무엇을 사도 빨강이에요' : `지금 쇼핑 가능 ${formatWon(shopping)}원`}
        </p>
      </div>

      <div className="mx-auto mt-6 w-full max-w-80">
        <Keypad value={value} onChange={setValue} maxLength={PRICE_DIGITS} extraKey="000" />
      </div>

      <p className="mt-2 h-5 text-center text-sm text-red" aria-live="polite">
        {error ?? ''}
      </p>
      <div className="mt-auto pt-4">
        <button type="submit" className={buttonClass('primary', 'disabled:opacity-40')} disabled={!canJudge}>
          판정 받기
        </button>
      </div>
    </form>
  )
}
