CREATE TABLE "admin_login_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_enabled" boolean DEFAULT false NOT NULL,
	"maintenance_date" date,
	"maintenance_message" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_login_tokens_email_idx" ON "admin_login_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_sessions_email_idx" ON "admin_sessions" USING btree ("email");