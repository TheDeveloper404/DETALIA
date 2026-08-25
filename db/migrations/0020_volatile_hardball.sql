ALTER TYPE "public"."notification_type" ADD VALUE 'MATERIAL_OFFER_SENT';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'MATERIAL_OFFER_EDITED';--> statement-breakpoint
CREATE TABLE "material_offer_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detail_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_offer_files" ADD CONSTRAINT "material_offer_files_offer_id_material_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."material_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_offers" ADD CONSTRAINT "material_offers_detail_id_details_id_fk" FOREIGN KEY ("detail_id") REFERENCES "public"."details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_offers" ADD CONSTRAINT "material_offers_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_offer_files_offer_id_idx" ON "material_offer_files" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_offers_detail_supplier_uq" ON "material_offers" USING btree ("detail_id","supplier_id");--> statement-breakpoint
CREATE INDEX "material_offers_detail_id_idx" ON "material_offers" USING btree ("detail_id");--> statement-breakpoint
CREATE INDEX "material_offers_supplier_id_idx" ON "material_offers" USING btree ("supplier_id");