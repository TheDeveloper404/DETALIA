CREATE TYPE "public"."activity_email_mode" AS ENUM('IN_APP', 'IMPORTANT', 'DAILY');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'APPROVAL_RECEIVED';--> statement-breakpoint
CREATE TABLE "notification_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"detail_id" uuid,
	"mode" "activity_email_mode" NOT NULL,
	"period_key" text,
	"status" text DEFAULT 'READY' NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_token" uuid,
	"first_attempt_at" timestamp with time zone,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_email_deliveries_periodKey_unique" UNIQUE("period_key")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "group_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activity_email_mode" "activity_email_mode" DEFAULT 'IMPORTANT' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_email_deliveries" ADD CONSTRAINT "notification_email_deliveries_detail_id_details_id_fk" FOREIGN KEY ("detail_id") REFERENCES "public"."details"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_email_deliveries_recipient_idx" ON "notification_email_deliveries" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "notification_email_deliveries_detail_idx" ON "notification_email_deliveries" USING btree ("detail_id");--> statement-breakpoint
CREATE INDEX "notification_email_deliveries_due_idx" ON "notification_email_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_email_delivery_id_notification_email_deliveries_id_fk" FOREIGN KEY ("email_delivery_id") REFERENCES "public"."notification_email_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_email_delivery_idx" ON "notifications" USING btree ("email_delivery_id");--> statement-breakpoint
CREATE INDEX "notifications_email_pending_idx" ON "notifications" USING btree ("recipient_user_id","email_due_at") WHERE "notifications"."email_due_at" is not null and "notifications"."email_delivery_id" is null and "notifications"."read_at" is null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_groupKey_unique" UNIQUE("group_key");