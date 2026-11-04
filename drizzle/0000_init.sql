CREATE TABLE "decisions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"month_id" integer NOT NULL,
	"name" varchar(60),
	"price" integer NOT NULL,
	"verdict" varchar(5) NOT NULL,
	"choice" varchar(6) NOT NULL,
	"shopping_available_at" integer NOT NULL,
	"over_amount" integer NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_verdict" CHECK ("decisions"."verdict" in ('red', 'green')),
	CONSTRAINT "decisions_choice" CHECK ("decisions"."choice" in ('held', 'bought')),
	CONSTRAINT "decisions_price_range" CHECK ("decisions"."price" between 1 and 100000000)
);
--> statement-breakpoint
CREATE TABLE "fixed_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_id" integer NOT NULL,
	"name" varchar(40) NOT NULL,
	"amount" integer NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "fixed_expenses_amount_nonneg" CHECK ("fixed_expenses"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "months" (
	"id" serial PRIMARY KEY NOT NULL,
	"ym" varchar(7) NOT NULL,
	"salary" integer NOT NULL,
	"card_balance" integer NOT NULL,
	"card_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"card_confirmed_amount" integer,
	"living_target" integer NOT NULL,
	"emergency_amount" integer NOT NULL,
	"shopping_budget_start" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "months_ym_unique" UNIQUE("ym"),
	CONSTRAINT "months_ym_format" CHECK ("months"."ym" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "months_amounts_nonneg" CHECK ("months"."salary" >= 0 and "months"."card_balance" >= 0 and "months"."living_target" >= 0 and "months"."emergency_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pay_day" integer DEFAULT 5 NOT NULL,
	"card_cutoff_day" integer DEFAULT 24 NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_pay_day_range" CHECK ("settings"."pay_day" between 1 and 31),
	CONSTRAINT "settings_cutoff_day_range" CHECK ("settings"."card_cutoff_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_month_idx" ON "decisions" USING btree ("month_id");--> statement-breakpoint
CREATE INDEX "fixed_expenses_month_idx" ON "fixed_expenses" USING btree ("month_id");