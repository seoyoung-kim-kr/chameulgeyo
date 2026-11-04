import { Pool } from '@neondatabase/serverless'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

// neon-serverless(WebSocket Pool) 를 쓰는 이유: neon-http 는 db.transaction() 을 지원하지 않는다.
// Node 런타임(22+)이라 WebSocket 이 내장돼 있고, Pool 은 모듈 전역에 하나 둔다.
// "요청마다 Pool 생성·종료" 규칙은 Edge 런타임용이다 (@neondatabase/serverless README).

function createPool() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  pool.on('error', (err: Error) => console.error('[db] pool error', err))
  // Vercel 함수 인스턴스가 잠들기 전에 유휴 연결이 정리되도록 붙여 둔다.
  attachDatabasePool(pool)
  return pool
}

// dev 서버의 HMR 로 모듈이 다시 평가될 때 Pool 이 쌓이지 않게 전역에 보관한다.
const globalForDb = globalThis as unknown as { sobiPool?: Pool }
const pool = globalForDb.sobiPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalForDb.sobiPool = pool

export const db = drizzle({ client: pool, schema })
export type Db = typeof db
