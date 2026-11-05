-- 다중 사용자 + 주기 기간 저장 (2026-11-05, Notion "2차 계획" 2.6·2.7·3).
-- 기존 데이터(PIN 시절, 한 사람 것)가 있으면 주인 없는 사용자 id 1 을 만들어 전부 묶는다.
-- OWNER_EMAIL 계정으로 처음 구글 로그인할 때 id 1 에 연결된다 (lib/users.ts).
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_sub" varchar(255),
	"email" varchar(320),
	"name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
INSERT INTO "users" ("id")
SELECT 1
WHERE EXISTS (SELECT 1 FROM "settings") OR EXISTS (SELECT 1 FROM "months")
   OR EXISTS (SELECT 1 FROM "card_bills") OR EXISTS (SELECT 1 FROM "decisions");
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce((SELECT max("id") FROM "users"), 1), (SELECT count(*) > 0 FROM "users"));
--> statement-breakpoint
ALTER TABLE "card_bills" DROP CONSTRAINT "card_bills_due_date_unique";--> statement-breakpoint
ALTER TABLE "months" DROP CONSTRAINT "months_ym_unique";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_single_row";--> statement-breakpoint
ALTER TABLE "card_bills" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "months" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "months" ADD COLUMN "cycle_start" date;--> statement-breakpoint
ALTER TABLE "months" ADD COLUMN "cycle_end" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "card_bills" SET "user_id" = 1;--> statement-breakpoint
UPDATE "decisions" SET "user_id" = 1;--> statement-breakpoint
UPDATE "months" SET "user_id" = 1;--> statement-breakpoint
UPDATE "settings" SET "user_id" = 1;--> statement-breakpoint
-- 주기 기간: lib/cycle.ts cycleFor 와 같은 규칙 (ym 달의 월급일 ~ 다음 달 월급일 전날, 없는 날은 말일로)
-- 월급일은 지금 설정값(없으면 기본 5)
WITH b AS (
  SELECT m."id",
         coalesce((SELECT s."pay_day" FROM "settings" s WHERE s."user_id" = m."user_id"), 5) AS pd,
         to_date(m."ym" || '-01', 'YYYY-MM-DD') AS f,
         (to_date(m."ym" || '-01', 'YYYY-MM-DD') + interval '1 month')::date AS nf
  FROM "months" m
)
UPDATE "months" m
SET "cycle_start" = b.f + (least(b.pd, extract(day FROM b.nf - 1)::int) - 1),
    "cycle_end" = b.nf + (least(b.pd, extract(day FROM (b.nf + interval '1 month')::date - 1)::int) - 1) - 1
FROM b
WHERE m."id" = b."id";
--> statement-breakpoint
ALTER TABLE "card_bills" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "months" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "months" ALTER COLUMN "cycle_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "months" ALTER COLUMN "cycle_end" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "settings" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "card_bills" ADD CONSTRAINT "card_bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_user_decided_idx" ON "decisions" USING btree ("user_id","decided_at");--> statement-breakpoint
ALTER TABLE "card_bills" ADD CONSTRAINT "card_bills_user_due_unique" UNIQUE("user_id","due_date");--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_user_ym_unique" UNIQUE("user_id","ym");
