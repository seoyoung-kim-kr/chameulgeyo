import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'

// 금액은 전부 원 단위 정수(int4, 최대 약 21억).

/** 단일 행(id = 1). 월급일·카드 확정일·카드 출금일 설정. */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    payDay: integer('pay_day').notNull().default(5),
    cardCutoffDay: integer('card_cutoff_day').notNull().default(24),
    /** 카드 대금 출금일. 새 대금의 기본 출금일 제안에만 쓴다 (실제 출금일은 card_bills.due_date) */
    cardPayDay: integer('card_pay_day').notNull().default(5),
    /** 월급·고정지출·카드값을 화면에서 ●●●●●● 로 가린다 (모든 기기 공통) */
    hideAmounts: boolean('hide_amounts').notNull().default(false),
  },
  (t) => [
    check('settings_single_row', sql`${t.id} = 1`),
    check('settings_pay_day_range', sql`${t.payDay} between 1 and 31`),
    check('settings_cutoff_day_range', sql`${t.cardCutoffDay} between 1 and 31`),
    check('settings_card_pay_day_range', sql`${t.cardPayDay} between 1 and 31`),
  ],
)

/** 예산 주기 하나 (월급일 ~ 다음 월급일 전날). ym = 주기 시작일이 속한 달. */
export const months = pgTable(
  'months',
  {
    id: serial('id').primaryKey(),
    ym: varchar('ym', { length: 7 }).notNull().unique(),
    salary: integer('salary').notNull(),
    /**
     * (구) 카드 이용금액 한 숫자. 0001 마이그레이션에서 card_bills 로 옮겼고 계산에는 더 쓰지 않는다.
     * 기존 데이터를 지우지 않으려고 남겨 둔다. 새로 저장할 때는 이 주기의 다음 대금 금액을 적어 둔다.
     */
    cardBalance: integer('card_balance').notNull(),
    /** (구) card_balance 를 옮겨 적은 시각. 계산에는 쓰지 않는다 (card_bills.updated_at 을 쓴다) */
    cardUpdatedAt: timestamp('card_updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** (구) 카드 확정일에 옮겨 적은 확정 금액. 계산에는 쓰지 않는다 */
    cardConfirmedAmount: integer('card_confirmed_amount'),
    livingTarget: integer('living_target').notNull(),
    emergencyAmount: integer('emergency_amount').notNull(),
    /** 월 설정 완료 시점의 쇼핑 예산 스냅샷 (홈 바의 기준) */
    shoppingBudgetStart: integer('shopping_budget_start').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('months_ym_format', sql`${t.ym} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check('months_amounts_nonneg', sql`${t.salary} >= 0 and ${t.cardBalance} >= 0 and ${t.livingTarget} >= 0 and ${t.emergencyAmount} >= 0`),
  ],
)

export const fixedExpenses = pgTable(
  'fixed_expenses',
  {
    id: serial('id').primaryKey(),
    monthId: integer('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 40 }).notNull(),
    amount: integer('amount').notNull(),
    sort: integer('sort').notNull(),
    /** 결제 수단. null = 미분류(기존 데이터). 계산에서는 계좌 출금으로 본다 (lib/cashflow.ts) */
    paymentMethod: varchar('payment_method', { length: 7, enum: ['account', 'card'] }),
  },
  (t) => [
    index('fixed_expenses_month_idx').on(t.monthId),
    check('fixed_expenses_amount_nonneg', sql`${t.amount} >= 0`),
    check('fixed_expenses_payment_method', sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('account', 'card')`),
  ],
)

/**
 * 카드 대금. 실제 출금(예정)일 기준으로 어느 급여 주기의 현금에서 빠지는지 정한다 (사용월·청구월과 무관).
 * 출금일 하나에 한 행. 앱에서 "산다"를 고르면 다음 주기 대금의 amount 에 더한다.
 */
export const cardBills = pgTable(
  'card_bills',
  {
    id: serial('id').primaryKey(),
    dueDate: date('due_date', { mode: 'string' }).notNull().unique(),
    /** 청구(예정)액 */
    amount: integer('amount').notNull(),
    /** 이미 출금된 금액 */
    paidAmount: integer('paid_amount').notNull().default(0),
    /** 이 금액에 카드 고정지출이 이미 들어 있는지. false 면 계산에서 카드 고정지출을 한 번 더한다 */
    includesCardFixed: boolean('includes_card_fixed').notNull().default(true),
    /** 카드사 앱 숫자를 마지막으로 옮겨 적은 시각 ("산다" 가산으로는 바뀌지 않는다) */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('card_bills_amount_nonneg', sql`${t.amount} >= 0`),
    check('card_bills_paid_range', sql`${t.paidAmount} >= 0`),
  ],
)

/** 판정 후 "안 산다 / 산다"를 고른 기록. id 는 클라이언트 nanoid (중복 = 재시도, 무시). */
export const decisions = pgTable(
  'decisions',
  {
    id: varchar('id', { length: 21 }).primaryKey(),
    monthId: integer('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }),
    price: integer('price').notNull(),
    verdict: varchar('verdict', { length: 5, enum: ['red', 'green'] }).notNull(),
    choice: varchar('choice', { length: 6, enum: ['held', 'bought'] }).notNull(),
    /** 판정 시점의 쇼핑 가능액 (표시값) */
    shoppingAvailableAt: integer('shopping_available_at').notNull(),
    overAmount: integer('over_amount').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    /** 환불·취소한 시각 (bought 만). 기록은 지우지 않는다 */
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    /** 환불액을 뺀 카드 대금의 출금일 */
    refundDueDate: date('refund_due_date', { mode: 'string' }),
    /**
     * true: 원래 대금 출금 전 취소 → 구매가 없던 것처럼 쇼핑 예산·준비금을 되돌린다
     * false: 출금 후 환불 → 원래 대금은 준비금으로 냈으므로 그대로 두고, 환불은 다음 청구에서 빠진다
     */
    refundBeforeBilling: boolean('refund_before_billing'),
  },
  (t) => [
    index('decisions_month_idx').on(t.monthId),
    check('decisions_cancel_bought_only', sql`${t.canceledAt} is null or ${t.choice} = 'bought'`),
    check('decisions_verdict', sql`${t.verdict} in ('red', 'green')`),
    check('decisions_choice', sql`${t.choice} in ('held', 'bought')`),
    check('decisions_price_range', sql`${t.price} between 1 and 100000000`),
  ],
)
