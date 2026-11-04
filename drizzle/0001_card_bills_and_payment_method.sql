CREATE TABLE "card_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"includes_card_fixed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_bills_due_date_unique" UNIQUE("due_date"),
	CONSTRAINT "card_bills_amount_nonneg" CHECK ("card_bills"."amount" >= 0),
	CONSTRAINT "card_bills_paid_range" CHECK ("card_bills"."paid_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "payment_method" varchar(7);--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "card_pay_day" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_payment_method" CHECK ("fixed_expenses"."payment_method" is null or "fixed_expenses"."payment_method" in ('account', 'card'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_card_pay_day_range" CHECK ("settings"."card_pay_day" between 1 and 31);--> statement-breakpoint
-- 데이터 이전 (수작업). 기존 데이터는 지우지 않는다.
-- 1) 카드 출금일은 지금까지와 같이 월급일로 둔다.
UPDATE "settings" SET "card_pay_day" = "pay_day";--> statement-breakpoint
-- 2) months.card_balance(기획서: 카드 앱의 이번 달 이용금액 = 다음 월급에서 빠질 돈)를
--    그 주기의 다음 월급일(= 다음 주기 시작일, 말일 클램프) 출금 대금으로 옮긴다.
--    fixed_expenses.payment_method 는 채우지 않는다 (미분류 = 계좌 출금으로 계산, 사용자가 분류).
INSERT INTO "card_bills" ("due_date", "amount", "includes_card_fixed")
SELECT
	make_date(
		extract(year from x.next_month)::int,
		extract(month from x.next_month)::int,
		least(p.pay_day, extract(day from (x.next_month + interval '1 month' - interval '1 day'))::int)
	),
	m."card_balance",
	true
FROM "months" m
CROSS JOIN LATERAL (SELECT coalesce((SELECT "pay_day" FROM "settings" WHERE "id" = 1), 5) AS pay_day) p
CROSS JOIN LATERAL (SELECT (to_date(m."ym" || '-01', 'YYYY-MM-DD') + interval '1 month')::date AS next_month) x
WHERE m."card_balance" > 0
ON CONFLICT ("due_date") DO NOTHING;
