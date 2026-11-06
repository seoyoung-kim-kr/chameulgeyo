import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

// 금액은 전부 원 단위 정수(int4, 최대 약 21억).
// 사용자 데이터는 전부 user_id 로 나뉜다. fixed_expenses 는 months 를 통해 소속된다.

/**
 * 구글 계정 하나 = 사용자 하나. google_sub 는 구글이 주는 변하지 않는 계정 id.
 * google_sub 가 null 인 행은 0004 마이그레이션이 기존(PIN 시절) 데이터를 묶어 둔 주인 없는 사용자다 (id 1).
 * OWNER_EMAIL 계정으로 처음 로그인할 때 그 계정에 연결된다 (lib/users.ts).
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  googleSub: varchar('google_sub', { length: 255 }).unique(),
  email: varchar('email', { length: 320 }),
  name: varchar('name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

const userRef = () =>
  integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })

/** 사용자당 한 행. 월급일·카드 확정일·카드 출금일 설정. */
export const settings = pgTable(
  'settings',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    payDay: integer('pay_day').notNull().default(5),
    cardCutoffDay: integer('card_cutoff_day').notNull().default(24),
    /** 카드 대금 출금일. 새 대금의 기본 출금일 제안에만 쓴다 (실제 출금일은 card_bills.due_date) */
    cardPayDay: integer('card_pay_day').notNull().default(5),
    /** 월급·고정지출·카드값을 화면에서 ●●●●●● 로 가린다 (모든 기기 공통) */
    hideAmounts: boolean('hide_amounts').notNull().default(false),
  },
  (t) => [
    check('settings_pay_day_range', sql`${t.payDay} between 1 and 31`),
    check('settings_cutoff_day_range', sql`${t.cardCutoffDay} between 1 and 31`),
    check('settings_card_pay_day_range', sql`${t.cardPayDay} between 1 and 31`),
  ],
)

/** 예산 주기 하나 (월급일 ~ 다음 월급일 전날). ym = 주기 시작일이 속한 달. 사용자마다 ym 하나. */
export const months = pgTable(
  'months',
  {
    id: serial('id').primaryKey(),
    userId: userRef(),
    ym: varchar('ym', { length: 7 }).notNull(),
    /**
     * 저장할 때의 주기 기간. 지난 주기를 볼 때 쓴다 (월급일을 나중에 바꾸면 지금 월급일로 다시 계산한 기간과 달라진다).
     * 0004 이전 행은 그때의 월급일로 채웠다.
     */
    cycleStart: date('cycle_start', { mode: 'string' }).notNull(),
    cycleEnd: date('cycle_end', { mode: 'string' }).notNull(),
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
    unique('months_user_ym_unique').on(t.userId, t.ym),
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
 * 사용자마다 출금일 하나에 한 행. 앱에서 "산다"를 고르면 다음 주기 대금의 amount 에 더한다.
 */
export const cardBills = pgTable(
  'card_bills',
  {
    id: serial('id').primaryKey(),
    userId: userRef(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
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
    unique('card_bills_user_due_unique').on(t.userId, t.dueDate),
    check('card_bills_amount_nonneg', sql`${t.amount} >= 0`),
    check('card_bills_paid_range', sql`${t.paidAmount} >= 0`),
  ],
)

/** 판정 후 "안 산다 / 산다"를 고른 기록. id 는 클라이언트 nanoid (중복 = 재시도, 무시). */
export const decisions = pgTable(
  'decisions',
  {
    id: varchar('id', { length: 21 }).primaryKey(),
    /** months 를 거치지 않고 거른다 (준비금 계산은 주기를 넘어 구매를 훑는다) */
    userId: userRef(),
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
    /**
     * 결제 수단 (bought 만 뜻이 있다). null = 0005 이전 기록 → 카드로 본다 (그때는 전부 카드로 계산했다).
     * account: 쇼핑 예산(넘으면 이번 주기 생활비)에서 빠지고 끝. 카드 대금·준비금 없음.
     * card: 대금에 가격 전액을 더하고, reserve_amount 만큼은 이번 주기 쇼핑 예산으로 묶는다(준비금).
     */
    paymentMethod: varchar('payment_method', { length: 7, enum: ['account', 'card'] }),
    /** 카드 구매 중 이번 주기 쇼핑 예산으로 묶은 금액 (0 ~ price). null = price 전액 (0005 이전 기록). 나머지는 다음 달로 미룬 금액 */
    reserveAmount: integer('reserve_amount'),
    /** 카드 구매가 출금되는 날 (구매 시점 설정으로 계산). null = 지금 설정으로 다시 계산 (0005 이전 기록) */
    dueDate: date('due_date', { mode: 'string' }),
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
    index('decisions_user_decided_idx').on(t.userId, t.decidedAt),
    check('decisions_cancel_bought_only', sql`${t.canceledAt} is null or ${t.choice} = 'bought'`),
    check('decisions_verdict', sql`${t.verdict} in ('red', 'green')`),
    check('decisions_choice', sql`${t.choice} in ('held', 'bought')`),
    check('decisions_price_range', sql`${t.price} between 1 and 100000000`),
    check('decisions_payment_method', sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('account', 'card')`),
    check('decisions_reserve_range', sql`${t.reserveAmount} is null or ${t.reserveAmount} between 0 and ${t.price}`),
  ],
)
