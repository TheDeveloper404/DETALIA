CREATE TYPE "public"."comment_vote_direction" AS ENUM('UP', 'DOWN');--> statement-breakpoint
ALTER TABLE "comment_likes" ADD COLUMN "direction" "comment_vote_direction" DEFAULT 'UP' NOT NULL;