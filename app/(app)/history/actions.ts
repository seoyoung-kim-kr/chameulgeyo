'use server'

import { refresh } from 'next/cache'
import { withUser, type ActionResult } from '@/lib/action'
import { cancelInternal, type CancelResult } from '@/lib/decisions'

/** "산다" 기록 환불·취소. 같은 기록을 여러 번 눌러도 한 번만 반영된다. */
export async function cancelPurchase(id: string): Promise<ActionResult<CancelResult>> {
  return withUser(async (userId) => {
    let result: ActionResult<CancelResult>
    try {
      result = await cancelInternal(userId, id)
    } catch (e) {
      console.error('[cancelPurchase]', e)
      return { ok: false, error: 'DB' }
    }
    if (result.ok) refresh()
    return result
  })
}
