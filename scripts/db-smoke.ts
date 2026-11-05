// DB 연결 확인: 읽기와 트랜잭션이 되는지 본다 (쓰지 않는다).
// 실행: npm run db:smoke
import { sql } from 'drizzle-orm'
import { db } from '../db'

async function main() {
  const where = await db.execute(sql`select current_setting('neon.branch_id', true) as branch, (select count(*) from users) as users`)
  console.log(where.rows[0])
  // 트랜잭션이 되는지도 확인 (neon-http 였다면 여기서 에러)
  const n = await db.transaction(async (tx) => (await tx.execute(sql`select 1 as one`)).rows.length)
  console.log('transaction ok:', n === 1)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
