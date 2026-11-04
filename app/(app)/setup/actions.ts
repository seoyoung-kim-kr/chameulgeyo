'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { fixedExpenses, months, settings } from '@/db/schema'
import { withSession, type ActionResult } from '@/lib/action'
import { upsertCycleBill } from '@/lib/bills'
import { computeBudget } from '@/lib/budget'
import { computeCashflow } from '@/lib/cashflow'
import { cardDueDate, cycleFor, nextCycle, todayKst } from '@/lib/cycle'
import { readReserves } from '@/lib/ledger'
import { saveMonthSchema, type SaveMonthInput } from '@/lib/validation'

/**
 * 월 설정 저장. settings → 이번 주기 months → fixed_expenses → 이번·다음 주기 카드 대금을 한 트랜잭션으로 쓴다.
 * - months 는 ym 기준 upsert. shopping_budget_start 는 insert 때만 정하고 재설정해도 유지한다.
 * - 카드 대금은 주기마다 한 건. 이미 있으면 금액만 바꾸고 출금일·출금 완료 여부는 유지한다 (lib/bills.ts).
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
    const next = nextCycle(cycle, v.payDay)

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(settings)
          .values({ id: 1, payDay: v.payDay, cardCutoffDay: v.cardCutoffDay, cardPayDay: v.cardPayDay })
          .onConflictDoUpdate({
            target: settings.id,
            set: { payDay: v.payDay, cardCutoffDay: v.cardCutoffDay, cardPayDay: v.cardPayDay },
          })

        await upsertCycleBill(tx, cycle, cardDueDate(cycle, v.cardPayDay), { amount: v.thisBill })
        await upsertCycleBill(tx, next, cardDueDate(next, v.cardPayDay), { amount: v.nextBill })

        // 쇼핑 예산 스냅샷: 이번 주기 현금에서 생활비·비상금을 뺀 값 (산 것은 아직 없다고 본다)
        const reserves = await readReserves(tx, { payDay: v.payDay, cardCutoffDay: v.cardCutoffDay, cardPayDay: v.cardPayDay }, cycle, next)
        const { cash } = computeCashflow({
          salary: v.salary,
          fixed: v.fixed.map((f) => ({ amount: f.amount, method: f.method })),
          bills: [{ dueDate: cycle.start, amount: v.thisBill, paidAmount: 0, includesCardFixed: true }],
          cycle,
          nextCycle: next,
          reserves,
        })
        const { shopping } = computeBudget({
          cash,
          livingTarget: v.livingTarget,
          emergencyAmount: v.emergencyAmount,
          spentShopping: 0,
          cycleDays: cycle.days,
        })

        const [month] = await tx
          .insert(months)
          .values({
            ym: cycle.ym,
            salary: v.salary,
            // (구) 컬럼. 계산에는 쓰지 않고, 이 주기의 다음 대금을 적어 둔다
            cardBalance: v.nextBill,
            livingTarget: v.livingTarget,
            emergencyAmount: v.emergencyAmount,
            shoppingBudgetStart: shopping,
          })
          .onConflictDoUpdate({
            target: months.ym,
            set: { salary: v.salary, cardBalance: v.nextBill, livingTarget: v.livingTarget, emergencyAmount: v.emergencyAmount },
          })
          .returning({ id: months.id })

        await tx.delete(fixedExpenses).where(eq(fixedExpenses.monthId, month.id))
        if (v.fixed.length > 0) {
          await tx
            .insert(fixedExpenses)
            .values(v.fixed.map((f, i) => ({ monthId: month.id, name: f.name, amount: f.amount, paymentMethod: f.method, sort: i })))
        }
      })
    } catch (e) {
      console.error('[saveMonth]', e)
      return { ok: false, error: 'DB' }
    }

    redirect('/')
  })
}
