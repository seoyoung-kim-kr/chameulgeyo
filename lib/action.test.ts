import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserId = vi.fn<() => Promise<number | null>>()
vi.mock('./session', () => ({ getUserId: () => getUserId() }))

const { withUser } = await import('./action')

describe('withUser', () => {
  beforeEach(() => getUserId.mockReset())

  it('세션이 없으면 본문을 실행하지 않고 UNAUTHORIZED', async () => {
    getUserId.mockResolvedValue(null)
    const fn = vi.fn(async () => ({ ok: true as const, data: 1 }))
    expect(await withUser(fn)).toEqual({ ok: false, error: 'UNAUTHORIZED' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('세션이 있으면 그 사용자 id 로 본문을 실행', async () => {
    getUserId.mockResolvedValue(3)
    const fn = vi.fn(async (id: number) => ({ ok: true as const, data: id }))
    expect(await withUser(fn)).toEqual({ ok: true, data: 3 })
    expect(fn).toHaveBeenCalledWith(3)
  })
})
