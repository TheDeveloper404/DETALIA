ALTER TYPE "public"."user_status" ADD VALUE 'DELETED';--> statement-breakpoint
DROP TABLE "invitations" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cover_position" integer DEFAULT 50 NOT NULL;