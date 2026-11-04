'use server'

import { redirect } from 'next/navigation'
import { db } from '@/db'
import { withSession, type ActionResult } from '@/lib/action'
import { upsertCycleBill } from '@/lib/bills'
import { cycleFor, inCycle, nextCycle, todayKst } from '@/lib/cycle'
import { DEFAULT_SETTINGS, readMonth, readSettings } from '@/lib/ledger'
import { saveCardBillsSchema, type SaveCardBillsInput } from '@/lib/validation'

/**
 * 카드 대금 저장 (이번 주기·다음 주기 각 1건). 카드사 앱의 숫자를 옮겨 적는다.
 * - "산다"로 다음 대금에 임시로 더해 둔 금액은 여기서 카드 앱 숫자로 덮어써 중복이 풀린다.
 * - 출금일은 각 주기 안이어야 한다. 밖이면 다른 주기의 현금에서 빠지므로 거부한다.
 * - 출금 완료는 현금 계산에 영향이 없다(주기 시작 기준). 남은 출금 표시에만 쓴다.
 */
export async function saveCardBills(input: SaveCardBillsInput): Promise<ActionResult> {
  return withSession(async () => {
    const parsed = saveCardBillsSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'INVALID' }
    const v = parsed.data

    try {
      const outcome = await db.transaction(async (tx) => {
        const s = (await readSettings(tx)) ?? DEFAULT_SETTINGS
        const cycle = cycleFor(todayKst(), s.payDay)
        const next = nextCycle(cycle, s.payDay)
        if (!(await readMonth(tx, cycle.ym))) return 'NO_MONTH' as const
        // 쓰기 전에 두 출금일을 모두 확인한다 (하나만 저장되는 일이 없게)
        if (!inCycle(v.thisBill.dueDate, cycle)) return 'THIS_OUT_OF_CYCLE' as const
        if (!inCycle(v.nextBill.dueDate, next)) return 'NEXT_OUT_OF_CYCLE' as const

        await upsertCycleBill(tx, cycle, v.thisBill.dueDate, {
          dueDate: v.thisBill.dueDate,
          amount: v.thisBill.amount,
          paidAmount: v.thisBill.paid ? v.thisBill.amount : 0,
          includesCardFixed: true,
        })
        await upsertCycleBill(tx, next, v.nextBill.dueDate, {
          dueDate: v.nextBill.dueDate,
          amount: v.nextBill.amount,
          includesCardFixed: v.nextBill.includesCardFixed,
        })
        return 'ok' as const
      })
      if (outcome !== 'ok') return { ok: false, error: outcome }
    } catch (e) {
      console.error('[saveCardBills]', e)
      return { ok: false, error: 'DB' }
    }

    redirect('/')
  })
}
