import { getUserId } from './session'

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

/**
 * 모든 서버 액션의 바깥을 감싼다. proxy 를 거치지 않으므로 여기서 직접 세션을 검증하고,
 * 본문은 로그인한 사용자 id 로만 읽고 쓴다.
 */
export async function withUser<T>(fn: (userId: number) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const userId = await getUserId()
  if (userId === null) return { ok: false, error: 'UNAUTHORIZED' }
  return fn(userId)
}
