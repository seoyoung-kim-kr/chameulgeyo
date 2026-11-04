'use server'

import { refresh } from 'next/cache'
import { withSession, type ActionResult } from '@/lib/action'
import { isValidPrice, type DecideResult } from '@/lib/budget'
import { chooseInternal, decideInternal } from '@/lib/decisions'
import type { ChooseInput } from '@/lib/validation'

/** 가격 → 서버 기준 판정. DB 에 쓰지 않는다. */
export async function decide(price: number): Promise<ActionResult<DecideResult>> {
  return withSession(async () => {
    if (!isValidPrice(price)) return { ok: false, error: 'INVALID_PRICE' }
    try {
      return await decideInternal(price)
    } catch (e) {
      console.error('[decide]', e)
      return { ok: false, error: 'DB' }
    }
  })
}

/** 안 산다 / 산다 기록. 같은 id 는 한 번만 반영된다. */
export async function choose(input: ChooseInput): Promise<ActionResult<{ duplicated: boolean }>> {
  return withSession(async () => {
    let result: ActionResult<{ duplicated: boolean }>
    try {
      result = await chooseInternal(input)
    } catch (e) {
      console.error('[choose]', e)
      return { ok: false, error: 'DB' }
    }
    if (result.ok) refresh()
    return result
  })
}
