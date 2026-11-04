import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'

// 금액은 전부 원 단위 정수(int4, 최대 약 21억).

/** 단일 행(id = 1). 월급일·카드 확정일 설정. */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    payDay: integer('pay_day').notNull().default(5),
    cardCutoffDay: integer('card_cutoff_day').notNull().default(24),
  },
  (t) => [
    check('settings_single_row', sql`${t.id} = 1`),
    check('settings_pay_day_range', sql`${t.payDay} between 1 and 31`),
    check('settings_cutoff_day_range', sql`${t.cardCutoffDay} between 1 and 31`),
  ],
)

/** 예산 주기 하나 (월급일 ~ 다음 월급일 전날). ym = 주기 시작일이 속한 달. */
export const months = pgTable(
  'months',
  {
    id: serial('id').primaryKey(),
    ym: varchar('ym', { length: 7 }).notNull().unique(),
    salary: integer('salary').notNull(),
    cardBalance: integer('card_balance').notNull(),
    /** 카드사 앱의 숫자를 옮겨 적은 시각. bought 가산으로는 바뀌지 않는다. */
    cardUpdatedAt: timestamp('card_updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** 카드 확정일에 옮겨 적은 확정 금액 */
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
  },
  (t) => [index('fixed_expenses_month_idx').on(t.monthId), check('fixed_expenses_amount_nonneg', sql`${t.amount} >= 0`)],
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
  },
  (t) => [
    index('decisions_month_idx').on(t.monthId),
    check('decisions_verdict', sql`${t.verdict} in ('red', 'green')`),
    check('decisions_choice', sql`${t.choice} in ('held', 'bought')`),
    check('decisions_price_range', sql`${t.price} between 1 and 100000000`),
  ],
)
