'use client'

import clsx from 'clsx'
import { canBuy, type DecideResult, type PurchaseMethod } from '@/lib/budget'
import { formatWon } from '@/lib/format'
import { Button } from './Button'
import { BottomActions, Card, Message } from './Screen'

type Props = {
  result: DecideResult
  productName: string
  onHold: () => void
  /** 산다. 어떤 돈으로 냈는지 함께 준다 */
  onBuy: (method: PurchaseMethod) => void
  onEdit: () => void
  /** 서버 판정·저장 대기 중: 원이 두근거리고 버튼이 잠긴다 */
  pending: boolean
  /** 판정을 서버가 확인했는지. 미리보기 상태에선 선택 버튼을 잠근다 */
  confirmed: boolean
  error: string | null
}

/**
 * 판정 결과.
 * - 초록: 현금(쇼핑 예산)에서 뺀다. 카드로 냈으면 작은 링크로 바꾼다 (예산 안이라 계산은 같다).
 * - 빨강: 궁서체 "지금은 사면 안 된다." 아래 세 갈래 (기획서 14번, 2026-11-06 개정)
 *   · 안 산다.
 *   · 카드로 산다… → 넘은 금액을 다음 달 카드값으로 미룬다. 다음 달 생활비가 바닥나면 막는다.
 *   · 생활비를 줄인다… → 넘은 금액만큼 이번 달 생활비가 준다. 이번 달 생활비가 바닥나면 막는다.
 */
export function TrafficLight({ result, productName, onHold, onBuy, onEdit, pending, confirmed, error }: Props) {
  const red = result.verdict === 'red'
  const locked = pending || !confirmed
  const cardOk = canBuy(result, 'card')
  const cashOk = canBuy(result, 'account')

  return (
    <>
      <div role="status" aria-live="polite" className="flex flex-col items-center pt-2 text-center">
        <div className="animate-pop motion-reduce:animate-none">
          <div
            aria-hidden
            className={clsx(
              'flex size-28 items-center justify-center rounded-full text-5xl font-bold text-white',
              red ? 'bg-pink shadow-[0_12px_30px_rgba(240,98,143,.35)]' : 'bg-green shadow-[0_12px_30px_rgba(63,167,118,.3)]',
              pending && 'animate-beat motion-reduce:animate-none',
            )}
          >
            {red ? '✕' : '✓'}
          </div>
        </div>

        {red ? (
          <>
            <h2 className="font-gungsuh mt-6 text-3xl text-ink">지금은 사면 안 된다.</h2>
            <p className="mt-3 text-sm text-muted">
              쇼핑 예산보다 <b className="text-red">{formatWon(result.overAmount)}원</b> 많아요.
              <br />
              {!cardOk && !cashOk
                ? '이번 달도 다음 달도 생활비가 바닥나요.'
                : !cashOk
                  ? '현금으로 사면 이번 달 생활비가 바닥나요.'
                  : !cardOk
                    ? '카드로 사면 다음 달 생활비가 바닥나요.'
                    : '넘는 만큼 생활비에서 빠져요.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-bold text-green">사도 괜찮아요</h2>
            <p className="mt-3 text-sm text-muted">
              사고 나면 쇼핑 예산이 <b className="text-green">{formatWon(result.shoppingAfter)}원</b> 남아요.
            </p>
          </>
        )}
      </div>

      <Card tone={red ? 'white' : 'green'} className="mt-3">
        <dl className="flex flex-col gap-2 text-sm">
          {productName.trim() && <Fact label="상품" value={productName.trim()} />}
          <Fact label="가격" value={`${formatWon(result.price)}원`} />
          <Fact label="남은 쇼핑 예산" value={`${formatWon(result.shopping)}원`} />
          {red && (
            <>
              <Fact
                label="카드로 사면 다음 달 생활비"
                value={`${formatWon(result.nextLivingNow)} → ${formatWon(result.nextLivingAfter)}원`}
                danger={result.nextLivingExhausted}
              />
              <Fact
                label="생활비를 줄이면 이번 달 생활비"
                value={`${formatWon(result.livingNow)} → ${formatWon(result.livingAfter)}원`}
                danger={result.livingExhausted}
              />
              <Fact
                label="하루 생활비"
                value={`${formatWon(result.livingPerDay)} → ${formatWon(result.livingAfterPerDay)}원`}
                danger={result.livingAfterPerDay < 0}
              />
            </>
          )}
        </dl>
      </Card>

      <BottomActions>
        <Message>{error && <span className="whitespace-pre-line">{error}</span>}</Message>
        {red ? (
          <>
            <Button className="font-gungsuh" onClick={onHold} disabled={locked}>
              안 산다.
            </Button>
            <Choice
              label="카드로 산다…"
              blocked={!cardOk}
              blockedText={`다음 달 생활비가 ${formatWon(-result.nextLivingAfter)}원 모자라요. 다음 달엔 굶어야 돼요.`}
              disabled={locked}
              onClick={() => onBuy('card')}
            />
            <Choice
              label="생활비를 줄인다…"
              blocked={!cashOk}
              blockedText={`이번 달 생활비가 ${formatWon(-result.livingAfter)}원 모자라요. 예비비를 깎아야 돼요.`}
              disabled={locked}
              onClick={() => onBuy('account')}
            />
          </>
        ) : (
          <>
            <Button onClick={() => onBuy('account')} disabled={locked}>
              살게요
            </Button>
            <Button variant="text" onClick={onHold} disabled={locked}>
              안 살래요
            </Button>
            <Button variant="text" className="text-sm" onClick={() => onBuy('card')} disabled={locked}>
              카드로 냈어요
            </Button>
          </>
        )}
        <Button variant="text" className="text-sm" onClick={onEdit} disabled={pending}>
          가격 수정
        </Button>
      </BottomActions>
    </>
  )
}

/** 빨강의 "그래도 산다" 갈래 하나. 막히면 버튼 대신 이유를 보여준다 (누를 수 없게). */
function Choice({ label, blocked, blockedText, disabled, onClick }: { label: string; blocked: boolean; blockedText: string; disabled: boolean; onClick: () => void }) {
  if (blocked) {
    return (
      <p className="text-center text-sm">
        <span className="font-gungsuh text-lg text-line line-through">{label}</span>
        <span className="mt-1 block text-xs text-red">{blockedText}</span>
      </p>
    )
  }
  return (
    <Button variant="text" className="font-gungsuh text-lg text-red active:text-red" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  )
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={clsx('min-w-0 truncate text-right font-bold', danger ? 'text-red' : 'text-ink')}>{value}</dd>
    </div>
  )
}
