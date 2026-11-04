ALTER TABLE "decisions" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "refund_due_date" date;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "refund_before_billing" boolean;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_cancel_bought_only" CHECK ("decisions"."canceled_at" is null or "decisions"."choice" = 'bought');