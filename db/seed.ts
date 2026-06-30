// Seed DETALIA — bootstrap minim necesar pe ORICE mediu (inclusiv prod):
//   Categoriile (idempotent pe slug) — fără ele nu se pot publica detalii.
// Conținutul demo (useri/detalii/validări/schițe) a fost ELIMINAT (2026-06-28) — era doar pentru
// verificare vizuală pe localhost. Vezi CHANGELOG. Seed-ul real de lansare se face prin conturi reale.
// Conturile de admin NU se mai creează aici: au auth separată (vezi `npm run admin:hash`).
// Rulează cu: `npm run db:seed`. Cere DATABASE_URL (Neon).
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  config();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL lipsește (.env.local sau .env). Nu pot rula seed-ul.");
  }

  const { db } = await import("./index");
  const { categories } = await import("./schema");

  // ── Categorii (idempotent pe slug) ──────────────────────────────────────────
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
