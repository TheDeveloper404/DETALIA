ALTER TYPE "public"."notification_type" ADD VALUE 'SKETCH_DELETED';--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "disapproves_parent" boolean DEFAULT false NOT NULL;