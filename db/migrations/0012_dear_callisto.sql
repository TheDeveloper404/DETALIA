CREATE TABLE "saved_details" (
	"user_id" uuid NOT NULL,
	"detail_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_details_user_id_detail_id_pk" PRIMARY KEY("user_id","detail_id")
);
--> statement-breakpoint
ALTER TABLE "saved_details" ADD CONSTRAINT "saved_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_details" ADD CONSTRAINT "saved_details_detail_id_details_id_fk" FOREIGN KEY ("detail_id") REFERENCES "public"."details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_details_detail_id_idx" ON "saved_details" USING btree ("detail_id");