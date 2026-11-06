import { z } from 'zod'
import { PRICE_MAX, PRICE_MIN } from './budget'

// 서버 액션 입력 검증. 클라이언트 타입은 믿지 않는다.
// 금액 상한 10억: DB 가 int4(최대 약 21억)라 합산 전 값이 넘치지 않게 막는다.
export const AMOUNT_MAX = 1_000_000_000
export const FIXED_MAX_COUNT = 30
export const FIXED_NAME_MAX = 40

const day = z.number().int().min(1).max(31)
const amount = z.number().int().min(0).max(AMOUNT_MAX)

/** 결제 수단. null = 미분류 (기존 데이터, 계좌 출금으로 계산) */
const paymentMethod = z.enum(['account', 'card']).nullable()

export const saveMonthSchema = z.object({
  payDay: day,
  cardCutoffDay: day,
  cardPayDay: day,
  salary: amount,
  /** 이번 주기에 출금되는(된) 카드 대금 */
  thisBill: amount,
  /** 다음 주기에 출금될 카드 대금 (카드 앱의 결제 예정 금액) */
  nextBill: amount,
  livingTarget: amount,
  emergencyAmount: amount,
  fixed: z
    .array(z.object({ name: z.string().trim().min(1).max(FIXED_NAME_MAX), amount, method: paymentMethod }))
    .max(FIXED_MAX_COUNT),
})

export type SaveMonthInput = z.infer<typeof saveMonthSchema>

export const DECISION_NAME_MAX = 60

/** choose 입력. id 는 클라이언트 nanoid(21자, URL-safe) — 더블탭·재시도에 같은 id 가 온다. */
/** 판정 기록 id (클라이언트 nanoid 21자) */
export const decisionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{21}$/)

export const chooseSchema = z.object({
  id: decisionIdSchema,
  name: z
    .string()
    .trim()
    .max(DECISION_NAME_MAX)
    .nullable()
    .transform((v) => (v ? v : null)),
  price: z.number().int().min(PRICE_MIN).max(PRICE_MAX),
  choice: z.enum(['held', 'bought']),
  /** 산 경우 실제로 낸 방법. 안 산 경우는 무시한다 */
  paymentMethod: z.enum(['account', 'card']).optional(),
})

export type ChooseInput = z.input<typeof chooseSchema>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** /card 저장. 이번 주기·다음 주기 대금 각 1건. 출금일이 그 주기 안인지는 서버가 주기를 계산해 확인한다 */
export const saveCardBillsSchema = z.object({
  thisBill: z.object({ dueDate: isoDate, amount, paid: z.boolean() }),
  nextBill: z.object({ dueDate: isoDate, amount, includesCardFixed: z.boolean() }),
})

export type SaveCardBillsInput = z.infer<typeof saveCardBillsSchema>
