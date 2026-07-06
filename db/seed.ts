// Seed DETALIA — bootstrap minim necesar pe ORICE mediu (inclusiv prod):
//   Categoriile — fără ele nu se pot publica detalii.
// Conținutul demo (useri/detalii/validări/schițe) a fost ELIMINAT (2026-06-28) — era doar pentru
// verificare vizuală pe localhost. Vezi CHANGELOG. Seed-ul real de lansare se face prin conturi reale.
// Conturile de admin NU se mai creează aici: au auth separată (vezi `npm run admin:hash`).
// Rulează cu: `npm run db:seed`. Cere DATABASE_URL (Neon).
import { config } from "dotenv";

// Taxonomia finală (Edi, `lista_categorii.md`, actualizată 2026-07-06 — ordine document + „Scări" +
// ierarhie reală pe 3 niveluri). Secțiuni = grupare vizuală (părinte, neselectabilă în UI). Unele
// „capitole" (Fundație, Acoperiș, Instalații, Fațadă) se împart la rândul lor în sub-categorii — capitolul
// însuși NU e bifabil, doar copiii lui (Edi: „Instalații este denumirea capitolului. Instalațiile se
// împart în cele patru [Electrice/Sanitare/Termice/HVAC]"). Restul frunzelor sunt bifabile direct
// (Edi: „bifezi oricâte", stil tag Pinterest) prin tabelul many-to-many `detail_categories`.
// ORDINEA contează — NU se mai sortează alfabetic, ci după `position` (vezi categoriesRepo.ts).
type Leaf = { slug: string; name: string; children?: { slug: string; name: string }[] };
const SECTIONS: { slug: string; name: string; leaves: Leaf[] }[] = [
  {
    slug: "clasificare-dupa-zona",
    name: "Clasificare după zonă",
    leaves: [
      {
        slug: "fundatie",
        name: "Fundație",
        children: [
          { slug: "beton", name: "Beton" },
          { slug: "micropiloti-insurubati", name: "Micropiloți înșurubați" },
        ],
      },
      { slug: "perete", name: "Perete" },
      { slug: "planseu", name: "Planșeu" },
      {
        slug: "acoperis",
        name: "Acoperiș",
        children: [
          { slug: "sarpanta", name: "Șarpantă" },
          { slug: "tip-terasa", name: "Tip terasă" },
        ],
      },
      { slug: "tamplarie", name: "Tâmplărie" },
      {
        slug: "instalatii",
        name: "Instalații",
        children: [
          { slug: "electrice", name: "Electrice" },
          { slug: "sanitare", name: "Sanitare" },
          { slug: "termice", name: "Termice" },
          { slug: "hvac", name: "HVAC" },
        ],
      },
      {
        slug: "fatada",
        name: "Fațadă",
        children: [
          { slug: "termosistem-clasic", name: "Termosistem clasic (vată/polistiren)" },
          { slug: "fatada-ventilata", name: "Fațadă ventilată" },
          { slug: "fatada-cortina", name: "Fațadă cortină" },
        ],
      },
      { slug: "amenajari-interioare", name: "Amenajări interioare" },
      { slug: "amenajari-exterioare", name: "Amenajări exterioare" },
      { slug: "scari", name: "Scări" },
    ],
  },
  {
    slug: "clasificare-dupa-sistem-constructiv",
    name: "Clasificare după sistem constructiv",
    leaves: [
      { slug: "constructii-industriale", name: "Construcții industriale" },
      { slug: "sistem-beton-zidarie", name: "Sistem Beton/Zidărie" },
      { slug: "sistem-timberframe", name: "Sistem Timberframe" },
      { slug: "sistem-light-steel-frame", name: "Sistem Light Steel Frame" },
      { slug: "sistem-sip", name: "Sistem SIP" },
      { slug: "sistem-clt", name: "Sistem CLT" },
      { slug: "sistem-mixt", name: "Sistem mixt" },
    ],
  },
  {
    slug: "alte-categorii",
    name: "Alte categorii",
    leaves: [
      { slug: "proiectare-complexa", name: "Proiectare complexă" },
      { slug: "constructii-modulare", name: "Construcții modulare" },
    ],
  },
];

async function main() {
  config({ path: ".env.local" });
  config();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL lipsește (.env.local sau .env). Nu pot rula seed-ul.");
  }

  const { db } = await import("./index");
  const { categories } = await import("./schema");

  // ── Categorii: taxonomia veche DRAFT se înlocuiește complet ────────────────
  // Sigur doar dacă nu există detalii care le referențiază încă (fază de validare de piață,
  // DB golită înainte de seed-ul de lansare — vezi handoff). Dacă `details`/`detail_categories`
  // au rânduri reale, comanda de mai jos eșuează pe FK — rulează abia după curățare.
  await db.delete(categories);

  // `position` = contor global crescător, în ORDINEA din document — nu alfabetic. Grupurile (secțiuni +
  // „capitole" cu copii, ex. Instalații) sunt isGroup=true (neselectabile); restul sunt bifabile.
  let position = 0;
  let leafCount = 0;
  for (const section of SECTIONS) {
    position += 1;
    const [sectionRow] = await db
      .insert(categories)
      .values({ slug: section.slug, name: section.name, parentId: null, position, isGroup: true })
      .returning({ id: categories.id });

    for (const leaf of section.leaves) {
      position += 1;
      const isGroupLeaf = !!leaf.children?.length;
      const [leafRow] = await db
        .insert(categories)
        .values({
          slug: leaf.slug,
          name: leaf.name,
          parentId: sectionRow.id,
          position,
          isGroup: isGroupLeaf,
        })
        .returning({ id: categories.id });
      if (!isGroupLeaf) leafCount += 1;

      if (leaf.children && leaf.children.length > 0) {
        for (const child of leaf.children) {
          position += 1;
          await db.insert(categories).values({
            slug: child.slug,
            name: child.name,
            parentId: leafRow.id,
            position,
            isGroup: false,
          });
          leafCount += 1;
        }
      }
    }
  }
  console.log(`Seed categorii: ${SECTIONS.length} secțiuni, ${leafCount} categorii bifabile.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed eșuat:", err);
    process.exit(1);
  });
