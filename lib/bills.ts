// 카드 대금 쓰기. 앱은 급여 주기마다 대금을 한 건으로 유지한다 (카드 한 장 기준).
// 세션 검사 없음: 서버 액션(withSession) 안에서만 부른다.
import { and, eq, gte, lte, ne } from 'drizzle-orm'
import { cardBills } from '@/db/schema'
import { inCycle, type Cycle } from './cycle'
import { readBills, type Executor } from './ledger'

export type BillPatch = {
  /** 바꿀 출금일. 없으면 기존 출금일, 기존도 없으면 defaultDue */
  dueDate?: string
  amount: number
  paidAmount?: number
  includesCardFixed?: boolean
}

/**
 * 주기 안의 대금을 patch 대로 한 건으로 맞춘다.
 * - 출금일은 반드시 그 주기 안이어야 한다 (밖이면 다른 주기의 현금에서 빠지므로 거부)
 * - 주기 안에 다른 대금이 더 있으면 지운다 (한 주기 한 건 → 같은 대금이 두 번 빠지지 않게)
 * - 금액이나 출금일이 바뀌었을 때만 updated_at 을 새로 찍는다 (카드 앱 숫자를 옮겨 적은 시각)
 */
export async function upsertCycleBill(q: Executor, cycle: Cycle, defaultDue: string, patch: BillPatch): Promise<'ok' | 'OUT_OF_CYCLE'> {
  const [existing] = await readBills(q, cycle.start, cycle.end)
  const dueDate = patch.dueDate ?? existing?.dueDate ?? defaultDue
  if (!inCycle(dueDate, cycle)) return 'OUT_OF_CYCLE'

  const amount = patch.amount
  const paidAmount = Math.min(patch.paidAmount ?? existing?.paidAmount ?? 0, amount)
  const includesCardFixed = patch.includesCardFixed ?? existing?.includesCardFixed ?? true
  const changed = !existing || existing.amount !== amount || existing.dueDate !== dueDate

  if (existing) {
    await q
      .delete(cardBills)
      .where(and(gte(cardBills.dueDate, cycle.start), lte(cardBills.dueDate, cycle.end), ne(cardBills.id, existing.id)))
    await q
      .update(cardBills)
      .set({ dueDate, amount, paidAmount, includesCardFixed, ...(changed ? { updatedAt: new Date() } : {}) })
      .where(eq(cardBills.id, existing.id))
  } else if (amount > 0) {
    await q.insert(cardBills).values({ dueDate, amount, paidAmount, includesCardFixed })
  }
  return 'ok'
}
