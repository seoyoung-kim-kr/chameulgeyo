import { getSession } from './session'

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

/** 모든 서버 액션의 바깥을 감싼다. proxy 를 거치지 않으므로 여기서 직접 세션을 검증한다. */
export async function withSession<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  if (!(await getSession())) return { ok: false, error: 'UNAUTHORIZED' }
  return fn()
}
