-- ⚠️ NU RULA ACEASTĂ MIGRAȚIE. Documentează retroactiv 3 coloane pe `users` (seen_badges,
-- last_seen_announcement_version, seen_detail_tour — badge-uri profil, „Ce e nou", tur ghidat)
-- adăugate manual pe Neon după catch-up-ul din 0017 (2026-08-16), fără `db:generate` ulterior.
-- Verificat DIRECT pe production (`describe_table_schema`, 2026-08-18) — coloanele EXISTĂ deja live.
-- Presupus (nu verificat separat) că sunt și pe dev, per convenția „orice ALTER pe ambele branch-uri".
-- Scopul fișierului e strict să servească drept bază corectă pentru următorul `drizzle-kit generate`.
ALTER TABLE "users" ADD COLUMN "seen_badges" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_announcement_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seen_detail_tour" boolean DEFAULT false NOT NULL;