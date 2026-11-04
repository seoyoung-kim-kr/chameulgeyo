'use server'

import { eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { months, settings } from '@/db/schema'
import { withSession, type ActionResult } from '@/lib/action'
import { cycleFor, todayKst } from '@/lib/cycle'
import { AMOUNT_MAX } from '@/lib/validation'

const schema = z.object({
  amount: z.number().int().min(0).max(AMOUNT_MAX),
  /** 확정일에 옮겨 적은 금액이면 card_confirmed_amount 에도 저장 */
  confirm: z.boolean(),
})

export type UpdateCardBalanceInput = z.infer<typeof schema>

/**
 * 카드사 앱의 숫자를 옮겨 적는다. 이번 주기 months 의 card_balance 와 card_updated_at 을 바꾼다.
 * bought 가산으로 임시 반영됐던 값은 여기서 덮어써 이중 계산이 해소된다 (기획서 7번).
 */
export async function updateCardBalance(input: UpdateCardBalanceInput): Promise<ActionResult> {
  return withSession(async () => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'INVALID' }
    const { amount, confirm } = parsed.data

    try {
      const [s] = await db.select({ payDay: settings.payDay }).from(settings).where(eq(settings.id, 1))
      const cycle = cycleFor(todayKst(), s?.payDay ?? 5)
      const updated = await db
        .update(months)
        .set({
          cardBalance: amount,
          cardUpdatedAt: new Date(),
          ...(confirm ? { cardConfirmedAmount: amount } : {}),
        })
        .where(eq(months.ym, cycle.ym))
        .returning({ id: months.id })
      if (updated.length === 0) return { ok: false, error: 'NO_MONTH' }
    } catch (e) {
      console.error('[updateCardBalance]', e)
      return { ok: false, error: 'DB' }
    }

    refresh()
    return { ok: true, data: undefined }
  })
}
