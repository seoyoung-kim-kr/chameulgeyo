'use client'

import clsx from 'clsx'
import type { DecideResult } from '@/lib/budget'
import { formatWon } from '@/lib/format'
import { Button } from './Button'

type Props = {
  result: DecideResult
  productName: string
  onHold: () => void
  onBuy: () => void
  /** 서버 판정·저장 대기 중: 원이 두근거리고 버튼이 잠긴다 */
  pending: boolean
  /** 판정을 서버가 확인했는지. 미리보기 상태에선 선택 버튼을 잠근다 */
  confirmed: boolean
}

/** 판정 결과 화면. 빨강일 때만 궁서체 세 줄이 나온다 (기획서 14번). */
export function TrafficLight({ result, productName, onHold, onBuy, pending, confirmed }: Props) {
  const red = result.verdict === 'red'
  const locked = pending || !confirmed
  const what = productName.trim() || '이 상품'

  return (
    <section role="status" aria-live="polite" className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pt-4 text-center">
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
              쇼핑 예산을 <b className="text-red">{formatWon(result.overAmount)}원</b> 넘겨요.
              <br />
              {result.livingExhausted ? '사면 생활비가 바닥나요.' : '그 돈은 생활비에서 빠져 나가요.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-bold text-green">사도 괜찮아요 ♡</h2>
            <p className="mt-3 text-sm text-muted">
              사고 나면 쇼핑 가능 <b className="text-green">{formatWon(result.shoppingAfter)}원</b>
            </p>
          </>
        )}
      </div>

      <dl className={clsx('mt-6 rounded-card border px-4 py-3 text-sm', red ? 'border-line bg-white' : 'border-green/30 bg-green-soft')}>
        <Fact label="쇼핑 가능" value={formatWon(result.shopping)} />
        <Fact label={what} value={formatWon(result.price)} />
        {red && (
          <>
            <Fact label="사면 생활비" value={`${formatWon(result.livingNow)} → ${formatWon(result.livingAfter)}`} danger={result.livingExhausted} />
            <Fact
              label="하루 생활비"
              value={`${formatWon(result.livingPerDay)} → ${formatWon(result.livingAfterPerDay)}`}
              danger={result.livingAfterPerDay < 0}
            />
          </>
        )}
      </dl>

      <div className="mt-auto flex flex-col items-center gap-1 pt-6">
        {red ? (
          <>
            <Button className="font-gungsuh" onClick={onHold} disabled={locked}>
              참을게요 ♡
            </Button>
            <Button variant="text" className="font-gungsuh text-lg text-red active:text-red" onClick={onBuy} disabled={locked}>
              그래도 산다…
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onBuy} disabled={locked}>
              살게요 ♡
            </Button>
            <Button variant="text" onClick={onHold} disabled={locked}>
              그래도 참을래요
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 truncate text-muted">{label}</dt>
      <dd className={clsx('shrink-0 font-bold', danger ? 'text-red' : 'text-ink')}>{value}</dd>
    </div>
  )
}
