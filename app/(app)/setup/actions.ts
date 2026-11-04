'use server'

import { eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { fixedExpenses, months, settings } from '@/db/schema'
import { withSession, type ActionResult } from '@/lib/action'
import { computeBudget } from '@/lib/budget'
import { cycleFor, todayKst } from '@/lib/cycle'
import { saveMonthSchema, type SaveMonthInput } from '@/lib/validation'

/**
 * 월 설정 저장. settings → 이번 주기 months → fixed_expenses 를 한 트랜잭션으로 쓴다.
 * - months 는 ym 기준 upsert. shopping_budget_start 는 insert 때만 정하고 재설정해도 유지한다.
 * - card_updated_at 은 카드값이 실제로 바뀌었을 때만 갱신한다 (카드사 숫자를 옮겨 적은 시각).
 * 성공하면 서버에서 홈으로 redirect 한다 (돌아오지 않는다). 클라이언트에서 router.push('/') 하면
 * 이번 주기 설정 전에 홈이 /setup 으로 보냈던 화면이 Activity 에 보존돼 있다가 되살아나
 * 다시 /setup 으로 튕긴다(2026-11-05 실측). 서버 redirect 는 새로 렌더링한 홈을 응답에 실어 보낸다.
 * 마법사 단계는 저장 후 defaults 가 바뀌어 key 로 새로 마운트되므로 따로 되돌리지 않는다.
 */
export async function saveMonth(input: SaveMonthInput): Promise<ActionResult> {
  return withSession(async () => {
    const parsed = saveMonthSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'INVALID' }
    const v = parsed.data

    // 주기는 서버 시각 + 저장하려는 월급일로 다시 계산한다
    const cycle = cycleFor(todayKst(), v.payDay)
    const fixedTotal = v.fixed.reduce((sum, f) => sum + f.amount, 0)
    const { shopping } = computeBudget({
      salary: v.salary,
      fixedTotal,
      cardBalance: v.cardBalance,
      livingTarget: v.livingTarget,
      emergencyAmount: v.emergencyAmount,
      cycleDays: cycle.days,
    })

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(settings)
          .values({ id: 1, payDay: v.payDay, cardCutoffDay: v.cardCutoffDay })
          .onConflictDoUpdate({ target: settings.id, set: { payDay: v.payDay, cardCutoffDay: v.cardCutoffDay } })

        const [month] = await tx
          .insert(months)
          .values({
            ym: cycle.ym,
            salary: v.salary,
            cardBalance: v.cardBalance,
            livingTarget: v.livingTarget,
            emergencyAmount: v.emergencyAmount,
            shoppingBudgetStart: shopping,
          })
          .onConflictDoUpdate({
            target: months.ym,
            set: {
              salary: v.salary,
              cardBalance: v.cardBalance,
              cardUpdatedAt: sql`case when ${months.cardBalance} <> excluded.card_balance then now() else ${months.cardUpdatedAt} end`,
              livingTarget: v.livingTarget,
              emergencyAmount: v.emergencyAmount,
            },
          })
          .returning({ id: months.id })

        await tx.delete(fixedExpenses).where(eq(fixedExpenses.monthId, month.id))
        if (v.fixed.length > 0) {
          await tx.insert(fixedExpenses).values(v.fixed.map((f, i) => ({ monthId: month.id, name: f.name, amount: f.amount, sort: i })))
        }
      })
    } catch (e) {
      console.error('[saveMonth]', e)
      return { ok: false, error: 'DB' }
    }

    redirect('/')
  })
}
