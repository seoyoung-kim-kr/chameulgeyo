// 판정 저장 로직. 세션 검사가 없으므로 'use server' 파일에 두면 안 된다
// ('use server' 파일의 export 는 전부 공개 서버 액션이 된다). 액션(app/(app)/check/actions.ts)과
// 멱등성 검증 스크립트(scripts/choose-idempotency.ts)만 import 한다.
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { decisions, fixedExpenses, months, settings } from '@/db/schema'
import type { ActionResult } from './action'
import { computeBudget, decisionFor, type DecideResult, type JudgeContext } from './budget'
import { cycleFor, todayKst } from './cycle'
import { chooseSchema, type ChooseInput } from './validation'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/**
 * 지금 주기의 판정 기준. 이번 주기 months 가 없으면 null.
 * lock 이면 months 행을 FOR UPDATE 로 잡아 같은 달의 choose 를 직렬화한다 (카드값 가산 경합 방지).
 */
async function loadJudgeContext(q: Executor, lock: boolean): Promise<{ monthId: number; ctx: JudgeContext } | null> {
  const [s] = await q.select({ payDay: settings.payDay }).from(settings).where(eq(settings.id, 1))
  const cycle = cycleFor(todayKst(), s?.payDay ?? 5)

  const base = q.select().from(months).where(eq(months.ym, cycle.ym))
  const [month] = lock ? await base.for('update') : await base
  if (!month) return null

  const [fixed] = await q
    .select({ total: sql<string>`coalesce(sum(${fixedExpenses.amount}), 0)` })
    .from(fixedExpenses)
    .where(eq(fixedExpenses.monthId, month.id))

  const { shoppingRaw } = computeBudget({
    salary: month.salary,
    fixedTotal: Number(fixed.total),
    cardBalance: month.cardBalance,
    livingTarget: month.livingTarget,
    emergencyAmount: month.emergencyAmount,
    cycleDays: cycle.days,
  })
  return { monthId: month.id, ctx: { shoppingRaw, livingTarget: month.livingTarget, cycleDays: cycle.days } }
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
 * - bought 이고 실제로 삽입됐을 때만 카드값에 가격을 더한다. card_updated_at 은 건드리지 않는다
 *   (갱신 시각은 카드사 숫자를 옮겨 적은 시각만 뜻한다, 기획서 7번)
 */
export async function chooseInternal(input: ChooseInput): Promise<ActionResult<{ duplicated: boolean }>> {
  const parsed = chooseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const v = parsed.data

  return db.transaction(async (tx) => {
    const loaded = await loadJudgeContext(tx, true)
    if (!loaded) return { ok: false, error: 'NO_MONTH' } as const

    const result = decisionFor(v.price, loaded.ctx)
    const inserted = await tx
      .insert(decisions)
      .values({
        id: v.id,
        monthId: loaded.monthId,
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

    if (v.choice === 'bought') {
      await tx
        .update(months)
        .set({ cardBalance: sql`${months.cardBalance} + ${v.price}` })
        .where(eq(months.id, loaded.monthId))
    }
    return { ok: true, data: { duplicated: false } } as const
  })
}
