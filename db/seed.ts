// Seed — creează conturile admin/seed din ADMIN_EMAILS (idempotent).
// Rulează cu: `npm run db:seed`. Cere DATABASE_URL (Neon) în .env.local sau .env.
//
// Admin = user normal al cărui email e în allowlist (vezi lib/admin.ts). Acest seed doar
// se asigură că rândul `users` există (cu un id stabil) ÎNAINTE de primul login — necesar
// ca detaliile seed să aibă autor și ca FK-urile created_by_admin_id/verified_by_admin_id
// să aibă pe ce sta. La login prin magic link, adapterul leagă același rând (email unic).
import { config } from "dotenv";

async function main() {
  // Încarcă env: .env.local (convenția Next) cu prioritate, apoi .env (folosit de drizzle-kit).
  config({ path: ".env.local" });
  config();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL lipsește (.env.local sau .env). Nu pot rula seed-ul.");
  }

  // Import după ce env e încărcat (db/index.ts citește DATABASE_URL la construire).
  const { db } = await import("./index");
  const { users } = await import("./schema");

  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.warn("ADMIN_EMAILS gol — niciun cont admin de creat.");
    return;
  }

  let created = 0;
  for (const email of emails) {
    const rows = await db
      .insert(users)
      .values({ email, name: "DETALIA Admin", status: "ACTIVE" })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (rows.length > 0) created += 1;
  }

  // Fără PII în loguri (emailurile NU se afișează) — doar numere.
  console.log(
    `Seed admin: ${emails.length} email(uri) procesate, ${created} cont(uri) noi create.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed eșuat:", err);
    process.exit(1);
  });
