// Seed DETALIA — bootstrap minim necesar pe ORICE mediu (inclusiv prod):
//   (A) Conturi admin din ADMIN_EMAILS (idempotent) — necesare pentru FK admin + autor seed real.
//   (B) Categoriile (idempotent pe slug) — fără ele nu se pot publica detalii.
// Conținutul demo (useri/detalii/validări/schițe) a fost ELIMINAT (2026-06-28) — era doar pentru
// verificare vizuală pe localhost. Vezi CHANGELOG. Seed-ul real de lansare se face prin conturi reale.
// Rulează cu: `npm run db:seed`. Cere DATABASE_URL (Neon).
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  config();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL lipsește (.env.local sau .env). Nu pot rula seed-ul.");
  }

  const { db } = await import("./index");
  const { users, categories } = await import("./schema");

  // ── (A) Admin din ADMIN_EMAILS ────────────────────────────────────────────
  const adminAddresses = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  let adminsCreated = 0;
  for (const address of adminAddresses) {
    const rows = await db
      .insert(users)
      .values({ email: address, name: "DETALIA Admin", status: "ACTIVE" })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (rows.length > 0) adminsCreated += 1;
  }
  console.log(`Seed admin: ${adminAddresses.length} adrese procesate, ${adminsCreated} conturi noi.`);

  // ── (B) Categorii (idempotent pe slug) ──────────────────────────────────────
  const categoryDefs = [
    { slug: "fundatie", name: "Fundație / infrastructură" },
    { slug: "anvelopa", name: "Anvelopă / termoizolare" },
    { slug: "acoperis", name: "Acoperiș" },
    { slug: "tamplarie", name: "Tâmplărie" },
    { slug: "instalatii", name: "Instalații" },
    { slug: "finisaje", name: "Finisaje / interior" },
  ];
  await db
    .insert(categories)
    .values(categoryDefs.map((c) => ({ slug: c.slug, name: c.name })))
    .onConflictDoNothing({ target: categories.slug });
  console.log(`Seed categorii: ${categoryDefs.length} procesate (idempotent pe slug).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed eșuat:", err);
    process.exit(1);
  });
