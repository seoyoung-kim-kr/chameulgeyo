// drizzle/ 의 마이그레이션을 DATABASE_URL 의 DB 에 적용한다. 이미 적용된 것은 건너뛴다.
// 실행: npm run db:migrate (로컬, .env.local) / Vercel 빌드 시 vercel-build 가 자동 실행
//
// drizzle-kit migrate 대신 drizzle-orm migrator 를 쓰는 이유: drizzle-kit 은 프록시 환경에서
// WebSocket 연결이 조용히 실패(exit 1)했다. 앱과 같은 드라이버(neon-serverless Pool)로 적용한다.
// Vercel 빌드에서 돌리는 이유: Neon 연동이 미리보기 배포마다 기본 브랜치를 복사해 새 DB 브랜치를
// 만드는데, 기본 브랜치에 테이블이 없으면 미리보기 DB 도 비어 있어 홈이 500 이 났다.
import { Pool } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 이 없습니다 (Vercel 환경변수 또는 .env.local 확인)')

  const pool = new Pool({ connectionString: url })
  try {
    const db = drizzle({ client: pool })
    // 어느 DB 에 적용하는지 빌드 로그에 남긴다 (연결 문자열은 찍지 않는다)
    const where = await db.execute(sql`select current_database() as db, current_setting('neon.branch_id', true) as branch`)
    console.log('[migrate] target', where.rows[0])
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('[migrate] ok')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('[migrate] failed', e)
  process.exit(1)
})
