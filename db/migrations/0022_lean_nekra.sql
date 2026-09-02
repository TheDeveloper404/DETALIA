CREATE TABLE "admin_pending_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_totp" (
	"email" text PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"backup_codes_hash" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_counter" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_pending_sessions_email_idx" ON "admin_pending_sessions" USING btree ("email");