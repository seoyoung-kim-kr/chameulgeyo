// DB 연결 확인: settings 기본 행을 만들고 읽어 온다.
// 실행: npm run db:smoke
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { settings } from '../db/schema'

async function main() {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing()
  const [row] = await db.select().from(settings).where(eq(settings.id, 1))
  console.log(row)
  // 트랜잭션이 되는지도 확인 (neon-http 였다면 여기서 에러)
  const n = await db.transaction(async (tx) => (await tx.execute(sql`select 1 as one`)).rows.length)
  console.log('transaction ok:', n === 1)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
