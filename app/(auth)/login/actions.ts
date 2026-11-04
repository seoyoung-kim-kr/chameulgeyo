'use server'

import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/action'
import { pinMatches } from '@/lib/pin'
import { startSession } from '@/lib/session'

const FAIL_DELAY_MS = 1500

export async function login(pin: string): Promise<ActionResult> {
  if (!pinMatches(pin, process.env.APP_PIN)) {
    // 무차별 대입을 느리게 만드는 최소한의 장치 (시도 횟수 저장은 비범위)
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS))
    return { ok: false, error: 'WRONG_PIN' }
  }
  await startSession()
  redirect('/')
}
