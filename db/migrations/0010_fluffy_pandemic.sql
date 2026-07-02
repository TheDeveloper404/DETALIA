CREATE TABLE "detail_categories" (
	"detail_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "detail_categories_detail_id_category_id_pk" PRIMARY KEY("detail_id","category_id")
);
--> statement-breakpoint
DROP INDEX "details_category_id_idx";--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "climate_zone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "climate_zone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "seismic_zone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "seismic_zone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "seismic_ag" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "seismic_tc" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "snow_load" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "wind_load" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "detail_categories" ADD CONSTRAINT "detail_categories_detail_id_details_id_fk" FOREIGN KEY ("detail_id") REFERENCES "public"."details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detail_categories" ADD CONSTRAINT "detail_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detail_categories_category_id_idx" ON "detail_categories" USING btree ("category_id");