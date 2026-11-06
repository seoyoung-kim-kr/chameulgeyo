-- 구매 결제수단 (2026-11-06, docs/requests/2026-11-06-calculation-audit.md 4절).
-- 기존 기록은 세 컬럼 모두 null 로 둔다 = 카드, 가격 전액 준비금, 출금일은 지금 설정으로 계산 (그때의 계산과 같다).
ALTER TABLE "decisions" ADD COLUMN "payment_method" varchar(7);--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "reserve_amount" integer;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_payment_method" CHECK ("decisions"."payment_method" is null or "decisions"."payment_method" in ('account', 'card'));--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_reserve_range" CHECK ("decisions"."reserve_amount" is null or "decisions"."reserve_amount" between 0 and "decisions"."price");