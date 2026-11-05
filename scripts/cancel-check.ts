// 환불·취소 검증 (dev DB 전용, 끝나면 되돌림). 실행: npm run db:check-cancel (대상 사용자 CHECK_USER_ID, 기본 1)
// 1) 청구 전 취소: 산 뒤 취소하면 다음 카드값·쇼핑 예산·다음 주기 예상 현금이 구매 전으로 돌아온다. 여러 번 취소해도 한 번만
// 2) 출금 후 환불: 원래 대금(이번 주기 대금)과 이번 현금은 그대로, 환불은 오늘 기준 다음 청구에서만 빠진다
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db'
import { cardBills, decisions } from '../db/schema'
import { statementDueDate, todayKst } from '../lib/cycle'
import { cancelInternal, chooseInternal } from '../lib/decisions'
import { readLedger } from '../lib/ledger'

const PRICE = 10_000
const USER = Number(process.env.CHECK_USER_ID ?? 1)

async function ledger() {
  const l = await readLedger(db, USER, todayKst())
  if (!l) throw new Error('이번 주기 월 설정이 없습니다')
  return l
}
const billAt = (l: Awaited<ReturnType<typeof ledger>>, due: string) => l.bills.find((b) => b.dueDate === due)?.amount ?? 0

async function main() {
  const before = await ledger()
  const savedBills = await db.select().from(cardBills).where(eq(cardBills.userId, USER))
  const ids = [nanoid(), nanoid()]
  let failed = false
  const check = (cond: boolean, msg: string) => {
    console.log(cond ? '  ok ' : '  FAIL', msg)
    if (!cond) failed = true
  }

  try {
    console.log('1) 청구 전 취소')
    await chooseInternal(USER, { id: ids[0], name: '환불 확인', price: PRICE, choice: 'bought' })
    const bought = await ledger()
    check(bought.budget.shoppingRaw === before.budget.shoppingRaw - PRICE, '산 뒤 쇼핑 예산 −가격')
    const c1 = await cancelInternal(USER, ids[0])
    const c2 = await cancelInternal(USER, ids[0])
    const [c3, c4] = await Promise.all([cancelInternal(USER, ids[0]), cancelInternal(USER, ids[0])])
    check(c1.ok && !c1.data.already && c1.data.beforeBilling, '첫 취소는 청구 전 취소로 반영')
    check([c2, c3, c4].every((r) => r.ok && r.data.already), '두 번째부터(동시 포함)는 already')
    const canceled = await ledger()
    check(canceled.budget.shoppingRaw === before.budget.shoppingRaw, '쇼핑 예산 원복')
    check(canceled.cashflow.nextBill.amount === before.cashflow.nextBill.amount, '다음 카드값 원복 (한 번만 뺌)')
    check(canceled.cashflow.nextBill.reserved === before.cashflow.nextBill.reserved, '준비금 원복')
    check(canceled.cashflow.nextCash === before.cashflow.nextCash && canceled.cashflow.cash === before.cashflow.cash, '현금 그대로')

    // 이번 주기 대금에 들어간 지난 주기 구매를 하나 만든다 (주기 시작 15일 전 사용)
    const { cardCutoffDay, cardPayDay } = before.settings
    const purchasedAt = new Date(Date.parse(`${before.cycle.start}T03:00:00Z`) - 15 * 24 * 60 * 60 * 1000)
    const originalDue = statementDueDate(todayKst(purchasedAt), cardCutoffDay, cardPayDay)
    const refundDue = statementDueDate(todayKst(), cardCutoffDay, cardPayDay)
    console.log(`2) 출금 후 환불 (${todayKst(purchasedAt)} 구매 → ${originalDue} 출금 → 오늘 환불 → ${refundDue} 대금에서 차감)`)
    await db.insert(decisions).values({
      id: ids[1],
      userId: USER,
      monthId: before.month.id,
      name: '지난달 구매',
      price: PRICE,
      verdict: 'green',
      choice: 'bought',
      shoppingAvailableAt: 0,
      overAmount: 0,
      decidedAt: purchasedAt,
    })
    const withOld = await ledger()
    check(withOld.cashflow.thisBill.reserved === before.cashflow.thisBill.reserved + PRICE, '지난 주기 구매는 이번 대금의 준비금')
    const r = await cancelInternal(USER, ids[1])
    check(r.ok && !r.data.beforeBilling && r.data.refundDue === refundDue, '출금 후 환불 → 다음 청구에서 차감')
    const refunded = await ledger()
    check(billAt(refunded, originalDue) === billAt(withOld, originalDue), '원래 대금 그대로')
    check(refunded.cashflow.thisBill.reserved === withOld.cashflow.thisBill.reserved, '원래 대금 준비금 그대로 (이미 준비금으로 냄)')
    check(refunded.cashflow.cash === withOld.cashflow.cash, '이번 주기 현금 그대로')
    check(billAt(refunded, refundDue) === billAt(withOld, refundDue) - PRICE, '환불 대금 −가격')
    check(refunded.cashflow.nextCash === withOld.cashflow.nextCash + PRICE, '다음 주기 예상 현금 +가격 (환불이 돌아옴)')
  } finally {
    await db.delete(decisions).where(inArray(decisions.id, ids))
    for (const b of savedBills) await db.update(cardBills).set({ amount: b.amount, updatedAt: b.updatedAt }).where(eq(cardBills.id, b.id))
    const keep = savedBills.map((b) => b.id)
    const now = await db.select({ id: cardBills.id }).from(cardBills).where(eq(cardBills.userId, USER))
    for (const b of now) if (!keep.includes(b.id)) await db.delete(cardBills).where(and(eq(cardBills.id, b.id), eq(cardBills.userId, USER)))
  }

  console.log(failed ? 'FAILED' : 'OK')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
