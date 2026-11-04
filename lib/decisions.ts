// 판정 저장 로직. 세션 검사가 없으므로 'use server' 파일에 두면 안 된다
// ('use server' 파일의 export 는 전부 공개 서버 액션이 된다). 액션(app/(app)/check/actions.ts)과
// 멱등성 검증 스크립트(scripts/choose-idempotency.ts)만 import 한다.
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cardBills, decisions } from '@/db/schema'
import type { ActionResult } from './action'
import { decisionFor, type DecideResult, type JudgeContext } from './budget'
import { cycleFor, statementDueDate, todayKst } from './cycle'
import { readBills, readLedger, type Executor, type Ledger } from './ledger'
import { chooseSchema, type ChooseInput } from './validation'

async function loadJudgeContext(q: Executor, lock: boolean): Promise<{ ledger: Ledger; ctx: JudgeContext } | null> {
  const ledger = await readLedger(q, todayKst(), lock)
  if (!ledger) return null
  const { budget, month, cycle } = ledger
  return { ledger, ctx: { shoppingRaw: budget.shoppingRaw, livingTarget: month.livingTarget, cycleDays: cycle.days } }
}

/** 서버 기준 판정. DB 에 쓰지 않는다. price 검증은 호출하는 쪽에서 한다. */
export async function decideInternal(price: number): Promise<ActionResult<DecideResult>> {
  const loaded = await loadJudgeContext(db, false)
  if (!loaded) return { ok: false, error: 'NO_MONTH' }
  return { ok: true, data: decisionFor(price, loaded.ctx) }
}

/**
 * 선택 기록. 클라이언트가 보낸 판정은 믿지 않고 트랜잭션 안에서 다시 판정해 저장한다.
 * - 같은 id 가 다시 오면(더블탭·재시도) 아무것도 바꾸지 않고 duplicated: true
 * - bought 이고 실제로 삽입됐을 때만:
 *   · 소비: decisions 에 남아 이번 주기 쇼핑 예산에서 빠진다 (ledger 의 boughtTotal)
 *   · 현금: 이 구매가 들어갈 카드 대금(오늘 기준 확정일·출금일로 계산)에 더한다.
 *     이미 소비 예산에서 뺐으므로 준비금으로 보고, 그 대금이 출금되는 주기 현금에서는 다시 빼지 않는다 (lib/cashflow.ts)
 *   updated_at 은 건드리지 않는다
 *   (카드사 숫자를 옮겨 적은 시각만 뜻한다. 다음에 카드 앱 숫자로 덮어쓰면 중복이 풀린다)
 */
export async function chooseInternal(input: ChooseInput): Promise<ActionResult<{ duplicated: boolean }>> {
  const parsed = chooseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const v = parsed.data

  return db.transaction(async (tx) => {
    const loaded = await loadJudgeContext(tx, true)
    if (!loaded) return { ok: false, error: 'NO_MONTH' } as const
    const { ledger } = loaded

    const result = decisionFor(v.price, loaded.ctx)
    const inserted = await tx
      .insert(decisions)
      .values({
        id: v.id,
        monthId: ledger.month.id,
        name: v.name,
        price: v.price,
        verdict: result.verdict,
        choice: v.choice,
        shoppingAvailableAt: result.shopping,
        overAmount: result.overAmount,
      })
      .onConflictDoNothing({ target: decisions.id })
      .returning({ id: decisions.id })

    if (inserted.length === 0) return { ok: true, data: { duplicated: true } } as const

    if (v.choice === 'bought') await addToBill(tx, ledger, v.price)
    return { ok: true, data: { duplicated: false } } as const
  })
}

/**
 * 이 구매가 들어갈 대금에 금액을 더한다. 확정일까지 쓴 것은 다음 출금일, 그 뒤는 그다음 출금일 대금이다.
 * 그 출금일이 속한 급여 주기에 대금이 이미 있으면 거기에 더하고, 없으면 그 날짜로 만든다
 * (카드 고정지출은 아직 안 들어 있다고 본다).
 */
async function addToBill(q: Executor, ledger: Ledger, price: number): Promise<void> {
  const { payDay, cardCutoffDay, cardPayDay } = ledger.settings
  const due = statementDueDate(todayKst(), cardCutoffDay, cardPayDay)
  const target = cycleFor(due, payDay)
  const [bill] = await readBills(q, target.start, target.end)
  if (bill) {
    await q
      .update(cardBills)
      .set({ amount: sql`${cardBills.amount} + ${price}` })
      .where(eq(cardBills.id, bill.id))
    return
  }
  await q
    .insert(cardBills)
    .values({ dueDate: due, amount: price, includesCardFixed: false })
    .onConflictDoUpdate({ target: cardBills.dueDate, set: { amount: sql`${cardBills.amount} + ${price}` } })
}
