'use client'

import clsx from 'clsx'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useState, useTransition, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/Field'
import { BottomActions, Card, Message } from '@/components/Screen'
import { Keypad } from '@/components/Keypad'
import { TrafficLight } from '@/components/TrafficLight'
import { useToast } from '@/components/Toast'
import { decisionFor, isValidPrice, PRICE_MAX, type DecideResult, type JudgeContext, type PurchaseMethod } from '@/lib/budget'
import { formatWon } from '@/lib/format'
import { DECISION_NAME_MAX } from '@/lib/validation'
import { choose, decide } from './actions'

type Props = { ctx: JudgeContext }

const PRICE_DIGITS = String(PRICE_MAX).length

const ERRORS: Record<string, string> = {
  INVALID: '입력한 값을 다시 확인해 주세요.',
  INVALID_PRICE: '가격은 1원부터 1억 원까지 입력할 수 있어요.',
  LIVING_EXHAUSTED: '이번 달 생활비가 모자라서 현금으로는 못 사요.',
  NEXT_LIVING_EXHAUSTED: '다음 달 생활비가 모자라서 카드로는 못 사요.',
  DB: '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.',
}

/** 가격 입력 → 판정 → 선택. 판정은 같은 순수 함수로 즉시 미리 보여주고 서버 응답으로 교체한다. */
export function CheckFlow({ ctx }: Props) {
  const { shoppingRaw } = ctx
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
    setResult(decisionFor(price, ctx))
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

  /** 안 산다 / 현금으로 산다 / 카드로 산다. 살 수 있는지는 서버가 같은 규칙으로 다시 확인한다 */
  const pick = (choice: 'held' | PurchaseMethod) => {
    if (!result || pending) return
    setError(null)
    const input =
      choice === 'held'
        ? { id: decisionId, name: name.trim() || null, price: result.price, choice: 'held' as const }
        : { id: decisionId, name: name.trim() || null, price: result.price, choice: 'bought' as const, paymentMethod: choice }
    startTransition(async () => {
      const res = await choose(input)
      if (!res.ok) return handleError(res.error)
      const won = formatWon(result.price)
      toast(
        choice === 'held'
          ? `${won}원 아꼈어요`
          : choice === 'card'
            ? result.overAmount > 0
              ? `카드값에 ${won}원을 더했어요. ${formatWon(result.overAmount)}원은 다음 달에 빠져요`
              : `카드값에 ${won}원을 더했어요`
            : `쇼핑 예산에서 ${won}원을 뺐어요`,
      )
      reset()
      router.push('/')
    })
  }

  if (step === 'verdict' && result) {
    return (
      <TrafficLight
        result={result}
        productName={name}
        pending={pending}
        confirmed={confirmed}
        error={error}
        onHold={() => pick('held')}
        onBuy={pick}
        onEdit={() => setStep('input')}
      />
    )
  }

  return (
    <form onSubmit={judgeNow} className="contents">
      <TextInput aria-label="상품 이름 (선택)" placeholder="상품 이름 (선택)" maxLength={DECISION_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />

      <Card tone="tint" className="text-center">
        <p className="text-sm text-muted">가격</p>
        <p className={clsx('mt-2 text-3xl font-bold', value === '' ? 'text-line' : 'text-deep')} aria-live="polite">
          {formatWon(price)}
          <span className="ml-0.5 text-base font-normal text-muted">원</span>
        </p>
        <p className={clsx('mt-2 text-xs', shoppingRaw < 0 ? 'text-red' : 'text-muted')}>
          {shoppingRaw < 0 ? `이번 달 쇼핑 예산을 ${formatWon(-shoppingRaw)}원 넘겼어요.` : `남은 쇼핑 예산 ${formatWon(shopping)}원`}
        </p>
      </Card>

      <Keypad value={value} onChange={setValue} maxLength={PRICE_DIGITS} extraKey="000" />

      <BottomActions>
        <Message>{error && <span className="whitespace-pre-line">{error}</span>}</Message>
        <Button type="submit" disabled={!canJudge}>
          확인하기
        </Button>
      </BottomActions>
    </form>
  )
}
