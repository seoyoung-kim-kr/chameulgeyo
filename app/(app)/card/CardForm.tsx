'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, buttonClass } from '@/components/Button'
import { DateInput, Field, MoneyInput } from '@/components/Field'
import { BottomActions, Card, Message } from '@/components/Screen'
import { shortDate, type Cycle } from '@/lib/cycle'
import { formatWon } from '@/lib/format'
import { saveCardBills } from './actions'

type Props = {
  cycle: Cycle
  next: Cycle
  thisBill: { dueDate: string; amount: number; paid: boolean }
  nextBill: { dueDate: string; amount: number; includesCardFixed: boolean }
  /** 카드로 결제하는 고정지출 합 (통신비·구독 등) */
  cardFixed: number
}

const ERRORS: Record<string, string> = {
  INVALID: '입력한 값을 다시 확인해 주세요.',
  NO_MONTH: '이번 달 설정이 없어요.',
  THIS_OUT_OF_CYCLE: '이번 카드값 출금일이 이번 주기 밖이에요.',
  NEXT_OUT_OF_CYCLE: '다음 카드값 출금일이 다음 주기 밖이에요.',
  DB: '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.',
}

const range = (c: Cycle) => `${shortDate(c.start)}~${shortDate(c.end)}`

/** 카드 대금 두 건(이번 주기 출금 / 다음 주기 출금 예정)을 카드 앱 숫자로 옮겨 적는다. */
export function CardForm({ cycle, next, thisBill: t0, nextBill: n0, cardFixed }: Props) {
  const router = useRouter()
  const [thisDue, setThisDue] = useState(t0.dueDate)
  const [thisAmount, setThisAmount] = useState(t0.amount)
  const [paid, setPaid] = useState(t0.paid)
  const [nextDue, setNextDue] = useState(n0.dueDate)
  const [nextAmount, setNextAmount] = useState(n0.amount)
  const [includesCardFixed, setIncludesCardFixed] = useState(n0.includesCardFixed)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveCardBills({
        thisBill: { dueDate: thisDue, amount: thisAmount, paid },
        nextBill: { dueDate: nextDue, amount: nextAmount, includesCardFixed },
      })
      // 성공하면 액션이 서버에서 홈으로 redirect 해 여기로 돌아오지 않는다
      if (!result.ok) {
        if (result.error === 'UNAUTHORIZED') return router.replace('/login')
        setError(ERRORS[result.error] ?? ERRORS.DB)
      }
    })
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4">
          <Field label="이번 카드값" aside={<span>{range(cycle)} 중 출금</span>}>
            <MoneyInput label="이번 카드값" value={thisAmount} onChange={setThisAmount} />
          </Field>
          <Field label="출금일">
            <DateInput
              aria-label="이번 카드값 출금일"
              min={cycle.start}
              max={cycle.end}
              value={thisDue}
              onChange={(e) => setThisDue(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-5 accent-pink" />
            이미 출금됐어요
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <Field label="다음 카드값" aside={<span>{range(next)} 중 출금 예정</span>}>
            <MoneyInput label="다음 카드값" value={nextAmount} onChange={setNextAmount} />
          </Field>
          <Field label="출금 예정일">
            <DateInput
              aria-label="다음 카드값 출금 예정일"
              min={next.start}
              max={next.end}
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </Field>
          {cardFixed > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includesCardFixed}
                onChange={(e) => setIncludesCardFixed(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-pink"
              />
              <span>
                카드 고정지출 {formatWon(cardFixed)}원이 이 금액에 들어 있어요.
                <br />
                <span className="text-muted">아직 결제 전이면 체크를 풀어 주세요. 계산에 한 번 더해요.</span>
              </span>
            </label>
          )}
        </div>
      </Card>

      <BottomActions>
        <Message>{error && <span className="whitespace-pre-line">{error}</span>}</Message>
        <Button onClick={save} disabled={pending}>
          {pending ? '저장 중…' : '저장'}
        </Button>
        <Link href="/" className={buttonClass('text')}>
          취소
        </Link>
      </BottomActions>
    </>
  )
}
