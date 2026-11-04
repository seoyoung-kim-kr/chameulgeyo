// Review Focus 3: "그래도 산다" 더블탭. 같은 id 로 choose 가 여러 번 와도 한 번만 반영된다.
// - 다음 주기 카드 대금은 가격만큼 한 번만 오른다 (현금은 출금되는 주기에 빠진다)
// - 이번 주기 현금(cash)은 그대로, 쇼핑 예산은 가격만큼 한 번만 준다 (소비)
// 세션을 우회해 chooseInternal 을 직접 부른다. 끝나면 만든 기록과 대금을 되돌린다.
// 실행: npm run db:check-choose (dev DB 에서만. 이번 주기 월 설정이 있어야 한다)
import { eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db'
import { cardBills, decisions } from '../db/schema'
import { todayKst } from '../lib/cycle'
import { chooseInternal } from '../lib/decisions'
import { readBills, readLedger } from '../lib/ledger'

const PRICE = 10_000

async function snapshot() {
  const ledger = await readLedger(db, todayKst())
  if (!ledger) throw new Error('이번 주기 월 설정이 없습니다. /setup 을 먼저 저장하세요')
  const [nextBill] = await readBills(db, ledger.next.start, ledger.next.end)
  return { ledger, nextBill: nextBill ?? null, nextAmount: nextBill?.amount ?? 0 }
}

async function main() {
  const before = await snapshot()
  const ids = [nanoid(), nanoid()]
  let failed = false
  const check = (cond: boolean, msg: string) => {
    console.log(cond ? '  ok ' : '  FAIL', msg)
    if (!cond) failed = true
  }

  try {
    // 1) 순차 재시도: 같은 id 두 번
    const a = await chooseInternal({ id: ids[0], name: '멱등성 확인', price: PRICE, choice: 'bought' })
    const b = await chooseInternal({ id: ids[0], name: '멱등성 확인', price: PRICE, choice: 'bought' })
    check(a.ok && !a.data.duplicated, '첫 호출은 삽입')
    check(b.ok && b.data.duplicated, '두 번째 호출은 duplicated: true')
    const mid = await snapshot()
    check(mid.nextAmount - before.nextAmount === PRICE, `순차 2회 → 다음 카드값 +${PRICE} 한 번만`)
    check(mid.ledger.cashflow.cash === before.ledger.cashflow.cash, '이번 주기 현금은 그대로')
    check(before.ledger.budget.shoppingRaw - mid.ledger.budget.shoppingRaw === PRICE, `쇼핑 예산 −${PRICE} 한 번만`)

    // 2) 동시 더블탭: 같은 id 두 요청이 겹쳐 도착
    const [c, d] = await Promise.all([
      chooseInternal({ id: ids[1], name: null, price: PRICE, choice: 'bought' }),
      chooseInternal({ id: ids[1], name: null, price: PRICE, choice: 'bought' }),
    ])
    const dup = [c, d].filter((r) => r.ok && r.data.duplicated).length
    check(c.ok && d.ok && dup === 1, '동시 2회 → 하나만 삽입, 하나는 duplicated')
    const after = await snapshot()
    check(after.nextAmount - mid.nextAmount === PRICE, `동시 2회 → 다음 카드값 +${PRICE} 한 번만`)

    const rows = await db.select().from(decisions).where(inArray(decisions.id, ids))
    check(rows.length === 2, 'decisions 행은 id 당 1개')
  } finally {
    await db.delete(decisions).where(inArray(decisions.id, ids))
    const now = await snapshot()
    if (before.nextBill) {
      await db.update(cardBills).set({ amount: before.nextBill.amount, updatedAt: before.nextBill.updatedAt }).where(eq(cardBills.id, before.nextBill.id))
    } else if (now.nextBill) {
      await db.delete(cardBills).where(eq(cardBills.id, now.nextBill.id))
    }
  }

  console.log(failed ? 'FAILED' : 'OK')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
