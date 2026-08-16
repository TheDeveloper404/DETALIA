-- ⚠️ NU RULA ACEASTĂ MIGRAȚIE. Documentează retroactiv schimbări deja aplicate manual pe AMBELE
-- branch-uri Neon (dev + production) între migrația 0016 și 2026-08-16 — feature-urile „Proiect",
-- canvas sharing, supplier-offers, comment-likes, plus alte coloane adăugate ad-hoc în aceeași
-- perioadă. Verificat obiect-cu-obiect (nu doar pe nume) direct pe ambele baze la 2026-08-16,
-- inclusiv 3 indecși pe canvas_items care lipseau REAL din DB (fix separat, vezi CHANGELOG) și 12
-- constrângeri redenumite manual ca să se potrivească exact cu ce generează Drizzle acum. Scopul
-- fișierului e strict să servească drept bază corectă pentru următorul `drizzle-kit generate` —
-- rularea lui ar eșua pe fiecare CREATE TABLE (tabelele există deja) sau, mai rău, ar crea
-- constrângeri/coloane DUPLICATE unde numele nu se potrivesc exact.
ALTER TYPE "public"."notification_type" ADD VALUE 'SUPPLIER_OFFERED';--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"user_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_likes_user_id_comment_id_pk" PRIMARY KEY("user_id","comment_id")
);
--> statement-breakpoint
CREATE TABLE "project_canvas_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"shared_by_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "project_members_project_user_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"invite_token" text NOT NULL,
	"invite_token_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "supplier_offers" (
	"user_id" uuid NOT NULL,
	"detail_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_offers_user_id_detail_id_pk" PRIMARY KEY("user_id","detail_id")
);
--> statement-breakpoint
ALTER TABLE "canvas_items" DROP CONSTRAINT "canvas_items_canvas_id_detail_id_pk";--> statement-breakpoint
ALTER TABLE "details" ALTER COLUMN "image_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD COLUMN "sketch_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "was_disapproval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "sketch_context_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "hidden_after_release" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "location" text DEFAULT 'România' NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "author_role_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "details" ADD COLUMN "released_from_project_id" uuid;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "is_annotation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "base_sketch_ids" jsonb;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "role_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "author_removed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "hidden_after_release" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sketches" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "validations" ADD COLUMN "hidden_after_release" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_canvas_shares" ADD CONSTRAINT "project_canvas_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_canvas_shares" ADD CONSTRAINT "project_canvas_shares_shared_by_user_id_users_id_fk" FOREIGN KEY ("shared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_detail_id_details_id_fk" FOREIGN KEY ("detail_id") REFERENCES "public"."details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_likes_comment_id_idx" ON "comment_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "project_canvas_shares_project_id_idx" ON "project_canvas_shares" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_canvas_shares_shared_by_user_id_idx" ON "project_canvas_shares" USING btree ("shared_by_user_id");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "supplier_offers_detail_id_idx" ON "supplier_offers" USING btree ("detail_id");--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_sketch_id_sketches_id_fk" FOREIGN KEY ("sketch_id") REFERENCES "public"."sketches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_sketch_context_id_sketches_id_fk" FOREIGN KEY ("sketch_context_id") REFERENCES "public"."sketches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "details" ADD CONSTRAINT "details_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "details" ADD CONSTRAINT "details_released_from_project_id_projects_id_fk" FOREIGN KEY ("released_from_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_items_sketch_id_idx" ON "canvas_items" USING btree ("sketch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_items_detail_only_uidx" ON "canvas_items" USING btree ("canvas_id","detail_id") WHERE sketch_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_items_sketch_uidx" ON "canvas_items" USING btree ("canvas_id","sketch_id") WHERE sketch_id is not null;--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_sketch_context_id_idx" ON "comments" USING btree ("sketch_context_id");--> statement-breakpoint
CREATE INDEX "details_project_id_idx" ON "details" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "details_released_from_project_id_idx" ON "details" USING btree ("released_from_project_id");--> statement-breakpoint
CREATE INDEX "details_published_created_idx" ON "details" USING btree ("created_at" DESC NULLS LAST) WHERE "details"."status" = 'PUBLISHED' AND "details"."project_id" IS NULL;--> statement-breakpoint
CREATE INDEX "sketches_detail_status_idx" ON "sketches" USING btree ("detail_id","status");