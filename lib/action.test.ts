import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSession = vi.fn<() => Promise<boolean>>()
vi.mock('./session', () => ({ getSession: () => getSession() }))

const { withSession } = await import('./action')

describe('withSession', () => {
  beforeEach(() => getSession.mockReset())

  it('세션이 없으면 본문을 실행하지 않고 UNAUTHORIZED', async () => {
    getSession.mockResolvedValue(false)
    const fn = vi.fn(async () => ({ ok: true as const, data: 1 }))
    expect(await withSession(fn)).toEqual({ ok: false, error: 'UNAUTHORIZED' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('세션이 있으면 본문 결과를 그대로', async () => {
    getSession.mockResolvedValue(true)
    expect(await withSession(async () => ({ ok: true as const, data: 1 }))).toEqual({ ok: true, data: 1 })
  })
})
