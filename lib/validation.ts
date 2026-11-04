import { z } from 'zod'
import { PRICE_MAX, PRICE_MIN } from './budget'

// 서버 액션 입력 검증. 클라이언트 타입은 믿지 않는다.
// 금액 상한 10억: DB 가 int4(최대 약 21억)라 합산 전 값이 넘치지 않게 막는다.
export const AMOUNT_MAX = 1_000_000_000
export const FIXED_MAX_COUNT = 30
export const FIXED_NAME_MAX = 40

const day = z.number().int().min(1).max(31)
const amount = z.number().int().min(0).max(AMOUNT_MAX)

export const saveMonthSchema = z.object({
  payDay: day,
  cardCutoffDay: day,
  salary: amount,
  cardBalance: amount,
  livingTarget: amount,
  emergencyAmount: amount,
  fixed: z
    .array(z.object({ name: z.string().trim().min(1).max(FIXED_NAME_MAX), amount }))
    .max(FIXED_MAX_COUNT),
})

export type SaveMonthInput = z.infer<typeof saveMonthSchema>

export const DECISION_NAME_MAX = 60

/** choose 입력. id 는 클라이언트 nanoid(21자, URL-safe) — 더블탭·재시도에 같은 id 가 온다. */
export const chooseSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{21}$/),
  name: z
    .string()
    .trim()
    .max(DECISION_NAME_MAX)
    .nullable()
    .transform((v) => (v ? v : null)),
  price: z.number().int().min(PRICE_MIN).max(PRICE_MAX),
  choice: z.enum(['held', 'bought']),
})

export type ChooseInput = z.input<typeof chooseSchema>
