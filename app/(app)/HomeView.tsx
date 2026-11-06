import clsx from 'clsx'
import Link from 'next/link'
import { Bucket } from '@/components/Bucket'
import { buttonClass } from '@/components/Button'
import { BottomActions, Card, Screen } from '@/components/Screen'
import { shortDate } from '@/lib/cycle'
import { formatWon } from '@/lib/format'

/** 다음 카드값을 이만큼 안 옮겨 적으면 확인하라고 알린다 */
const STALE_DAYS = 3

/** 예비비 통 아래 설명. 저축이 아니라 이번 주기에 따로 남겨 두는 돈이라는 걸 밝힌다 */
export const EMERGENCY_DESC = '예상하지 못한 지출에 대비해 이번 주기에 따로 남겨두는 돈이에요.'

/** 가린 금액 자리. 자릿수가 드러나지 않게 길이를 고정한다 */
export const MASK = '••••••'

export type HomeViewProps = {
  ym: string
  cycleStart: string
  cycleEnd: string
  nextStart: string
  nextEnd: string
  salary: number
  /** 현금에서 빠지는 고정지출 (계좌 + 미분류) */
  fixedCashOut: number
  /** 카드로 결제하는 고정지출 (카드값에 들어 있어 따로 빼지 않음) */
  fixedCard: number
  unclassifiedCount: number
  /** reserved = 살 때 쇼핑 예산에서 빼 두고 출금일까지 통장에 남겨 둘 돈, deferred = 그 구매 중 쇼핑 예산을 넘겨 월급에서 빠지는 돈 */
  thisBill: { dueDate: string | null; amount: number; reserved: number; fromCash: number; paid: number; remaining: number; deferred: number }
  nextBill: { dueDate: string | null; amount: number; reserved: number; fromCash: number; deferred: number }
  nextBillStaleDays: number | null
  isCutoff: boolean
  /** 이번 달 배분할 돈 (현금): 월급 − 고정지출 − 카드값 */
  cash: number
  nextCash: number
  shopping: number
  shoppingRaw: number
  shoppingExhausted: boolean
  /** 카드로 다음 달에 미룬 금액 (예산을 넘긴 카드 구매) */
  deferred: number
  /** 이번 주기에 카드로 산 금액 합 */
  boughtCard: number
  shoppingBudgetStart: number
  boughtTotal: number
  livingNow: number
  livingPerDay: number
  emergencyAmount: number
  heldTotal: number
  /** 월급·고정지출·카드값을 가린다 (설정의 스위치) */
  hideAmounts: boolean
  /** 저장한 지난 주기 중 가장 최근 것. 있으면 "지난 달" 링크를 보인다 */
  previousYm: string | null
}

export const range = (a: string, b: string) => `${shortDate(a)}~${shortDate(b)}`

export function HomeView(p: HomeViewProps) {
  const stale = p.nextBillStaleDays === null || p.nextBillStaleDays >= STALE_DAYS
  const hide = p.hideAmounts
  // 월급·고정지출·카드값만 가린다. 배분할 돈·예산·판정 금액은 그대로 보인다
  const priv = (n: number) => (hide ? MASK : formatWon(n))
  // 이번 주기 처음 정한 쇼핑 예산 중 얼마나 남았는지
  const barPct = p.shoppingBudgetStart > 0 ? (p.shopping / p.shoppingBudgetStart) * 100 : 0

  return (
    <Screen
      title={`${Number(p.ym.slice(5))}월 지갑`}
      sub={range(p.cycleStart, p.cycleEnd)}
      action={
        <Link
          href="/card"
          className={clsx(
            'inline-flex h-7 items-center rounded-full px-3 text-xs active:opacity-70',
            stale ? 'bg-soft text-red' : 'border border-line bg-white text-muted',
          )}
        >
          {p.nextBillStaleDays === null ? '카드값 입력' : stale ? '카드값 확인 필요' : '카드값'}
        </Link>
      }
    >
      {p.isCutoff && (
        <Link href="/card" className="rounded-card bg-soft p-4 text-sm text-deep active:opacity-80">
          <span className="block font-bold">오늘은 카드값 확정일이에요.</span>
          <span className="block">다음 카드값을 확인해 주세요.</span>
        </Link>
      )}
      {p.unclassifiedCount > 0 && (
        <Link href="/setup" className="rounded-card bg-soft p-4 text-sm text-deep active:opacity-80">
          <span className="block font-bold">결제 수단을 고르지 않은 고정지출이 {p.unclassifiedCount}건 있어요.</span>
          <span className="block">고르기 전까지는 계좌 출금으로 계산해요.</span>
        </Link>
      )}

      <Card aria-label="이번 달 배분할 돈">
        <p className="text-sm text-muted">이번 달 배분할 돈</p>
        <p className={clsx('mt-2 text-3xl font-bold', p.cash < 0 ? 'text-red' : 'text-deep')}>
          {formatWon(p.cash)}
          <span className="ml-0.5 text-base">원</span>
        </p>
        <p className="mt-1 text-xs text-muted">월급에서 고정지출과 카드값을 제외한 금액이에요.</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-tint p-3 text-center">
          <Term label="월급" value={priv(p.salary)} />
          <Term label="계좌 고정지출" value={hide ? MASK : `−${formatWon(p.fixedCashOut)}`} />
          <Term
            label={p.thisBill.dueDate ? `카드값 ${shortDate(p.thisBill.dueDate)}` : '이번 카드값'}
            value={hide ? MASK : `−${formatWon(p.thisBill.fromCash)}`}
          />
        </dl>
        <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
          {p.thisBill.dueDate === null ? (
            <p className="text-red">이번 카드값을 아직 입력하지 않았어요.</p>
          ) : p.thisBill.remaining > 0 ? (
            <p>
              {hide
                ? `${shortDate(p.thisBill.dueDate)} 카드값이 아직 다 빠지지 않았어요.`
                : `${shortDate(p.thisBill.dueDate)} 카드값 중 ${formatWon(p.thisBill.remaining)}원이 아직 안 빠졌어요.`}
            </p>
          ) : (
            <p>{shortDate(p.thisBill.dueDate)} 카드값은 이미 빠졌어요.</p>
          )}
          {p.thisBill.reserved > 0 && (
            <p>
              앱에서 산 {formatWon(p.thisBill.reserved)}원은 살 때 쇼핑 예산에서 빼고 남겨 둔 돈으로 내요.
              {hide ? ' 그래서 이번 월급에서는 그만큼 덜 빼요.' : ` 그래서 이번 월급에서는 ${formatWon(p.thisBill.fromCash)}원만 빼요.`}
              {p.thisBill.deferred > 0 && ` 그중 ${formatWon(p.thisBill.deferred)}원은 쇼핑 예산을 넘긴 금액이라 이번 월급에서 빠져요.`}
            </p>
          )}
          {p.nextBill.reserved > 0 && (
            <p>
              이 중 {formatWon(p.nextBill.reserved)}원은 카드값으로 남겨둘 돈이에요
              {p.nextBill.dueDate ? ` (${shortDate(p.nextBill.dueDate)}까지 통장에 남겨 두세요).` : '.'}
            </p>
          )}
          {p.fixedCard > 0 && (
            <p>
              {hide
                ? '카드 고정지출은 카드값에 들어 있어 따로 빼지 않아요.'
                : `카드 고정지출 ${formatWon(p.fixedCard)}원은 카드값에 들어 있어 따로 빼지 않아요.`}
            </p>
          )}
        </div>
      </Card>

      <Link href="/card" className="rounded-card border border-line bg-white p-4 active:bg-tint" aria-label="다음 카드값">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">
            다음 카드값{p.nextBill.dueDate ? ` · ${shortDate(p.nextBill.dueDate)} 출금 예정` : ''}
          </p>
          <p className="text-lg font-bold">{hide ? MASK : `${formatWon(p.nextBill.amount)}원`}</p>
        </div>
        {p.nextBill.reserved > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-tint p-3 text-center">
            <Term label="이번 주기에 남겨둘 돈" value={formatWon(p.nextBill.reserved)} />
            <Term label="다음 월급에서 낼 돈" value={priv(p.nextBill.fromCash)} />
          </dl>
        )}
        <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
          {p.nextBill.reserved > 0 && (
            <p>
              앱에서 산 {formatWon(p.nextBill.reserved)}원은 살 때 쇼핑 예산에서 뺐어요. 다음 카드값을 위해
              {p.nextBill.dueDate ? ` ${shortDate(p.nextBill.dueDate)}까지` : ''} 통장에 남겨 두세요.
              {hide ? ' 나머지는 다음 월급에서 내요.' : ` 나머지 ${formatWon(p.nextBill.fromCash)}원은 다음 월급에서 내요.`}
              {p.nextBill.deferred > 0 && ` 그중 ${formatWon(p.nextBill.deferred)}원은 쇼핑 예산을 넘긴 금액이에요.`}
            </p>
          )}
          {p.nextBill.reserved > 0 && p.livingNow < 0 && (
            <p className="text-red">이번 달 생활비가 모자라서 남겨둘 돈을 다 못 남길 수 있어요. 못 남긴 만큼 다음 월급에서 더 빠져요.</p>
          )}
          <p>
            다음 주기({range(p.nextStart, p.nextEnd)}) 예상 현금{' '}
            <b className={p.nextCash < 0 ? 'text-red' : 'text-ink'}>{formatWon(p.nextCash)}원</b>
          </p>
        </div>
      </Link>

      <Bucket
        highlight
        name="쇼핑 예산"
        amount={formatWon(p.shoppingRaw)}
        amountTone={p.shoppingExhausted ? 'red' : 'deep'}
        sub={p.shoppingExhausted ? `쇼핑 예산 ${formatWon(-p.shoppingRaw)}원 초과` : undefined}
        subTone="red"
        bar={{ pct: barPct, label: '남은 쇼핑 예산' }}
      >
        <ShoppingNote shoppingRaw={p.shoppingRaw} deferred={p.deferred} boughtCard={p.boughtCard} />
      </Bucket>
      <Bucket name="생활비" amount={formatWon(p.livingNow)} sub={`하루 ${formatWon(p.livingPerDay)}원`} />
      <Bucket tone="green" name="예비비" amount={formatWon(p.emergencyAmount)}>
        <p className="mt-2 text-xs text-muted">{EMERGENCY_DESC}</p>
      </Bucket>

      <p className="py-1 text-center text-sm text-muted">
        이번 달 아낀 돈 <span className="font-bold text-green">+{formatWon(p.heldTotal)}원</span>
      </p>

      <BottomActions>
        <Link href="/check" className={buttonClass('primary')}>
          사기 전에 확인하기
        </Link>
        <div className="flex justify-center gap-2">
          {p.previousYm && (
            <Link href={`/cycle/${p.previousYm}`} className={buttonClass('text')}>
              지난 달
            </Link>
          )}
          <Link href="/history" className={buttonClass('text')}>
            기록
          </Link>
          <Link href="/setup" className={buttonClass('text')}>
            설정
          </Link>
        </div>
      </BottomActions>
    </Screen>
  )
}

/**
 * 쇼핑 예산 통 아래 설명. 카드로 산 돈은 지금 통장에서 안 나가고 카드값으로 빠진다는 것과,
 * 예산을 넘긴 돈이 어디서 나가는지(카드면 다음 월급, 현금이면 이번 달 생활비)를 말한다.
 */
export function ShoppingNote({ shoppingRaw, deferred, boughtCard }: { shoppingRaw: number; deferred: number; boughtCard: number }) {
  const fromLiving = Math.max(-(shoppingRaw + deferred), 0)
  const lines: string[] = []
  if (boughtCard > 0) lines.push(`카드로 산 ${formatWon(boughtCard)}원은 지금 통장에서 안 나가고 카드값으로 빠져요.`)
  if (deferred > 0) lines.push(`넘긴 ${formatWon(deferred)}원은 다음 월급에서 빠져요.`)
  if (fromLiving > 0) lines.push(`넘긴 ${formatWon(fromLiving)}원은 이번 달 생활비에서 빠져요.`)
  if (lines.length === 0) return null
  return <p className="mt-2 text-xs text-muted">{lines.join(' ')}</p>
}

export function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold">{value}</dd>
    </div>
  )
}
