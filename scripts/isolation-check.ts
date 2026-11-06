// 사용자 격리 검증 (dev DB 전용). 실행: npm run db:check-isolation
// 임시 사용자 A·B 를 만들어 같은 주기·같은 출금일 데이터를 넣고, 한쪽의 읽기·쓰기가 다른 쪽에 닿지 않는지 본다.
// 구글 계정 → 사용자 연결(findOrCreateUser)도 확인한다. 기존 데이터 사용자(id 1) 연결은 트랜잭션 안에서만 해 보고 되돌린다.
// 끝나면 임시 사용자를 지운다 (ON DELETE CASCADE 로 그 사용자 데이터도 지워진다).
import { eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db'
import { cardBills, decisions, fixedExpenses, months, settings, users } from '../db/schema'
import { upsertCycleBill } from '../lib/bills'
import { cardDueDate, cycleFor, nextCycle, todayKst } from '../lib/cycle'
import { cancelInternal, chooseInternal } from '../lib/decisions'
import { readBills, readLedger, readLedgerByYm, readMonth } from '../lib/ledger'
import { LEGACY_USER_ID, findOrCreateUser } from '../lib/users'

const tag = `check-isolation-${nanoid(8)}`
let failed = false
const check = (cond: boolean, msg: string) => {
  console.log(cond ? '  ok ' : '  FAIL', msg)
  if (!cond) failed = true
}

class Rollback extends Error {}

async function makeUser(label: string, salary: number, thisBill: number, nextBill: number): Promise<number> {
  const [u] = await db.insert(users).values({ googleSub: `${tag}-${label}`, email: `${label}@${tag}.invalid` }).returning({ id: users.id })
  const cycle = cycleFor(todayKst(), 5)
  const next = nextCycle(cycle, 5)
  await db.insert(settings).values({ userId: u.id, payDay: 5, cardCutoffDay: 24, cardPayDay: 5 })
  const [m] = await db
    .insert(months)
    .values({ userId: u.id, ym: cycle.ym, cycleStart: cycle.start, cycleEnd: cycle.end, salary, cardBalance: nextBill, livingTarget: 300_000, emergencyAmount: 0, shoppingBudgetStart: 0 })
    .returning({ id: months.id })
  await db.insert(fixedExpenses).values({ monthId: m.id, name: '월세', amount: 500_000, sort: 0, paymentMethod: 'account' })
  await db.insert(cardBills).values([
    { userId: u.id, dueDate: cardDueDate(cycle, 5), amount: thisBill },
    { userId: u.id, dueDate: cardDueDate(next, 5), amount: nextBill },
  ])
  return u.id
}

async function ledger(userId: number) {
  const l = await readLedger(db, userId, todayKst())
  if (!l) throw new Error(`user ${userId} ledger missing`)
  return l
}

async function main() {
  const created: number[] = []
  try {
    console.log('1) 데이터 분리')
    const a = await makeUser('a', 3_000_000, 1_000_000, 700_000)
    created.push(a)
    const b = await makeUser('b', 2_000_000, 400_000, 300_000)
    created.push(b)
    const [la, lb] = [await ledger(a), await ledger(b)]
    check(la.month.userId === a && lb.month.userId === b, '같은 ym 이라도 각자 자기 주기를 읽는다')
    check(la.cashflow.cash === 3_000_000 - 500_000 - 1_000_000, `A 현금 ${la.cashflow.cash}`)
    check(lb.cashflow.cash === 2_000_000 - 500_000 - 400_000, `B 현금 ${lb.cashflow.cash}`)
    check(la.bills.every((x) => x.userId === a) && lb.bills.every((x) => x.userId === b), '같은 출금일 대금도 각자 것만')

    console.log('2) 산다·취소')
    const id = nanoid()
    const r = await chooseInternal(a, { id, name: '격리 확인', price: 10_000, choice: 'bought', paymentMethod: 'card' })
    check(r.ok && !r.data.duplicated, 'A 산다')
    const [la2, lb2] = [await ledger(a), await ledger(b)]
    check(la2.cashflow.nextBill.amount === la.cashflow.nextBill.amount + 10_000, 'A 다음 카드값 +10,000')
    check(JSON.stringify(lb2.cashflow) === JSON.stringify(lb.cashflow) && lb2.boughtTotal === 0, 'B 장부는 그대로')
    const dupFromB = await chooseInternal(b, { id, name: '같은 id', price: 10_000, choice: 'bought', paymentMethod: 'card' })
    check(dupFromB.ok && dupFromB.data.duplicated, 'B 가 같은 id 를 보내도 A 기록을 덮지 않는다 (duplicated)')
    check((await ledger(b)).boughtTotal === 0, '그때도 B 쇼핑 예산은 그대로')
    const c = await cancelInternal(b, id)
    check(!c.ok && c.error === 'NOT_FOUND', 'B 는 A 기록을 취소할 수 없다 (NOT_FOUND)')
    const [row] = await db.select().from(decisions).where(eq(decisions.id, id))
    check(row.userId === a && row.canceledAt === null, 'A 기록은 취소되지 않았다')

    console.log('3) 대금 쓰기')
    const cycle = la.cycle
    await upsertCycleBill(db, b, cycle, cardDueDate(cycle, 5), { amount: 410_000 })
    const aBills = await readBills(db, a, cycle.start, cycle.end)
    check(aBills.length === 1 && aBills[0].amount === 1_000_000, 'B 가 이번 대금을 고쳐도 A 대금은 지워지지도 바뀌지도 않는다')
    check((await readBills(db, b, cycle.start, cycle.end))[0].amount === 410_000, 'B 대금만 바뀐다')

    console.log('4) 조회')
    check((await readMonth(db, b, cycle.ym))?.id === lb.month.id, 'readMonth 는 자기 주기')
    check((await readLedgerByYm(db, b, cycle.ym))?.heldTotal === 0, '지난 주기 조회도 자기 기록만')
    check((await readMonth(db, b, '1999-01')) === null, '없는 주기는 null')

    console.log('5) 구글 계정 → 사용자')
    const profile = { sub: `${tag}-g`, email: `g@${tag}.invalid`, emailVerified: true, name: '확인' }
    const g1 = await db.transaction((tx) => findOrCreateUser(tx, profile, undefined))
    created.push(g1)
    const g2 = await db.transaction((tx) => findOrCreateUser(tx, { ...profile, name: '이름 바뀜' }, undefined))
    check(g1 === g2, '같은 구글 계정은 같은 사용자')
    const [g] = await db.select().from(users).where(eq(users.id, g1))
    check(g.name === '이름 바뀜' && g.lastLoginAt !== null, '다시 로그인하면 이름·마지막 로그인 갱신')
    check(g1 !== LEGACY_USER_ID, 'OWNER_EMAIL 이 아니면 기존 데이터 사용자에 연결되지 않는다')
    const [gp] = await Promise.all([
      db.transaction((tx) => findOrCreateUser(tx, { ...profile, sub: `${tag}-p` }, undefined)),
      db.transaction((tx) => findOrCreateUser(tx, { ...profile, sub: `${tag}-p` }, undefined)).catch(() => -1),
    ])
    created.push(gp)
    const same = await db.select().from(users).where(eq(users.googleSub, `${tag}-p`))
    check(same.length === 1, '같은 계정이 동시에 들어와도 사용자는 하나')

    const [legacy] = await db.select().from(users).where(eq(users.id, LEGACY_USER_ID))
    if (legacy && legacy.googleSub === null) {
      const owner = `owner@${tag}.invalid`
      try {
        await db.transaction(async (tx) => {
          const o1 = await findOrCreateUser(tx, { sub: `${tag}-o`, email: owner.toUpperCase(), emailVerified: true, name: null }, owner)
          check(o1 === LEGACY_USER_ID, 'OWNER_EMAIL 계정(대소문자 달라도)은 기존 데이터 사용자에 연결')
          const o2 = await findOrCreateUser(tx, { sub: `${tag}-o2`, email: owner, emailVerified: true, name: null }, owner)
          check(o2 !== LEGACY_USER_ID, '연결은 한 번만: 같은 이메일의 다른 구글 계정은 새 사용자')
          const o3 = await findOrCreateUser(tx, { sub: `${tag}-o`, email: owner, emailVerified: true, name: null }, owner)
          check(o3 === LEGACY_USER_ID, '연결된 계정으로 다시 로그인하면 기존 데이터 사용자')
          throw new Rollback()
        })
      } catch (e) {
        if (!(e instanceof Rollback)) throw e
      }
      const [after] = await db.select().from(users).where(eq(users.id, LEGACY_USER_ID))
      check(after.googleSub === null, '(되돌림) 기존 데이터 사용자는 여전히 주인 없음')
      const [unverified] = await db.transaction(async (tx) => [await findOrCreateUser(tx, { sub: `${tag}-u`, email: owner, emailVerified: false, name: null }, owner)])
      created.push(unverified)
      check(unverified !== LEGACY_USER_ID, '확인 안 된 이메일은 연결하지 않는다')
    } else {
      console.log('  skip 기존 데이터 사용자가 없거나 이미 연결됨 → 연결 확인 생략')
    }
  } finally {
    if (created.length) await db.delete(users).where(inArray(users.id, created))
    const left = await db.execute(sql`select count(*)::int as n from users where google_sub like ${tag + '%'}`)
    check(Number(left.rows[0].n) === 0, '임시 사용자 정리')
  }
  console.log(failed ? 'FAILED' : 'OK')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
