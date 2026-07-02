ALTER TABLE "details" DROP CONSTRAINT "details_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "details" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "details" DROP COLUMN "seismic_zone";