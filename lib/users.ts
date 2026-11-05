// 구글 계정 → 사용자. 세션 검사 없음: 로그인 콜백에서만 부른다.
import { and, eq, isNull, sql } from 'drizzle-orm'
import { users } from '@/db/schema'
import { isOwner, type GoogleProfile } from './google'
import type { Executor } from './ledger'

/** 0004 마이그레이션이 기존(PIN 시절) 데이터를 묶어 둔 주인 없는 사용자 */
export const LEGACY_USER_ID = 1

/**
 * 1. 이미 연결된 구글 계정이면 그 사용자 (이메일·이름·마지막 로그인 갱신)
 * 2. OWNER_EMAIL 계정이고 기존 데이터 사용자가 아직 주인 없으면 그 사용자에 연결 (한 번만)
 * 3. 아니면 새 사용자 (같은 계정이 동시에 들어와도 google_sub unique 로 하나만 생긴다)
 */
export async function findOrCreateUser(q: Executor, profile: GoogleProfile, ownerEmail: string | undefined): Promise<number> {
  const now = new Date()
  const info = { email: profile.email, name: profile.name, lastLoginAt: now }

  const [existing] = await q.update(users).set(info).where(eq(users.googleSub, profile.sub)).returning({ id: users.id })
  if (existing) return existing.id

  if (isOwner(profile, ownerEmail)) {
    const [claimed] = await q
      .update(users)
      .set({ googleSub: profile.sub, ...info })
      .where(and(eq(users.id, LEGACY_USER_ID), isNull(users.googleSub)))
      .returning({ id: users.id })
    if (claimed) return claimed.id
  }

  const [created] = await q
    .insert(users)
    .values({ googleSub: profile.sub, ...info })
    .onConflictDoUpdate({ target: users.googleSub, set: { lastLoginAt: sql`excluded.last_login_at` } })
    .returning({ id: users.id })
  return created.id
}
