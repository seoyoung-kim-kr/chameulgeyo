// Review Focus 3: "그래도 산다" 더블탭. 같은 id 로 choose 가 여러 번 와도 카드값은 한 번만 오른다.
// 세션을 우회해 chooseInternal 을 직접 부른다. 끝나면 만든 기록과 카드값을 되돌린다.
// 실행: npm run db:check-choose (dev DB 에서만. 이번 주기 월 설정이 있어야 한다)
import { eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db'
import { decisions, months, settings } from '../db/schema'
import { cycleFor, todayKst } from '../lib/cycle'
import { chooseInternal } from '../lib/decisions'

const PRICE = 10_000

async function cardBalance(ym: string): Promise<number> {
  const [m] = await db.select({ v: months.cardBalance }).from(months).where(eq(months.ym, ym))
  if (!m) throw new Error(`이번 주기(${ym}) 월 설정이 없습니다. /setup 을 먼저 저장하세요`)
  return m.v
}

async function main() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1))
  const ym = cycleFor(todayKst(), s?.payDay ?? 5).ym
  const original = await cardBalance(ym)
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
    check((await cardBalance(ym)) - original === PRICE, `순차 2회 → 카드값 +${PRICE} 한 번만`)

    // 2) 동시 더블탭: 같은 id 두 요청이 겹쳐 도착
    const before = await cardBalance(ym)
    const [c, d] = await Promise.all([
      chooseInternal({ id: ids[1], name: null, price: PRICE, choice: 'bought' }),
      chooseInternal({ id: ids[1], name: null, price: PRICE, choice: 'bought' }),
    ])
    const dup = [c, d].filter((r) => r.ok && r.data.duplicated).length
    check(c.ok && d.ok && dup === 1, '동시 2회 → 하나만 삽입, 하나는 duplicated')
    check((await cardBalance(ym)) - before === PRICE, `동시 2회 → 카드값 +${PRICE} 한 번만`)

    const rows = await db.select().from(decisions).where(inArray(decisions.id, ids))
    check(rows.length === 2, 'decisions 행은 id 당 1개')
  } finally {
    await db.delete(decisions).where(inArray(decisions.id, ids))
    await db.update(months).set({ cardBalance: original }).where(eq(months.ym, ym))
  }

  console.log(failed ? 'FAILED' : 'OK')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
