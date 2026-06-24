// Seed DETALIA.
//   (A) Conturi admin din ADMIN_EMAILS (idempotent) — necesare pentru FK admin + autor seed real.
//   (B) 🔴 CONȚINUT DEMO (categorii, useri cu roluri, detalii, validări, comentarii, schițe) — DOAR pentru
//       verificare vizuală pe localhost. DE ȘTERS înainte de prod (vezi .remember/remember.md). Idempotent:
//       dacă userii demo au deja detalii, sare peste recrearea conținutului.
// Rulează cu: `npm run db:seed`. Cere DATABASE_URL (Neon) în .env.local sau .env.
import { config } from "dotenv";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

async function main() {
  config({ path: ".env.local" });
  config();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL lipsește (.env.local sau .env). Nu pot rula seed-ul.");
  }

  const { db } = await import("./index");
  const { eq } = await import("drizzle-orm");
  const { users, roles, categories, details, validations, comments, sketches } = await import(
    "./schema"
  );

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

  // ── (B) Conținut demo ──────────────────────────────────────────────────────
  // Categorii (idempotent pe slug).
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
  const catRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const catId = (slug: string) => {
    const r = catRows.find((c) => c.slug === slug);
    if (!r) throw new Error(`Categoria ${slug} lipsește.`);
    return r.id;
  };

  // Useri demo cu roluri (idempotent pe email).
  const userDefs = [
    {
      key: "andrei",
      address: "andrei@detalia.dev",
      name: "Andrei Munteanu",
      headline: "Proiectez detalii de execuție pentru locuințe și clădiri publice.",
      location: "Cluj-Napoca",
      website: "https://exemplu.ro",
      roleMain: "PROIECTANT" as const,
      subRole: "Arhitect",
      verificationStatus: "VERIFIED" as const,
    },
    {
      key: "ioana",
      address: "ioana@detalia.dev",
      name: "Ioana Pop",
      headline: "Inginer structurist — interesată de racorduri și punți termice.",
      location: "Brașov",
      website: null,
      roleMain: "PROIECTANT" as const,
      subRole: "Inginer structurist",
      verificationStatus: "DECLARED" as const,
    },
    {
      key: "mihai",
      address: "mihai@detalia.dev",
      name: "Mihai Radu",
      headline: "Execut acoperișuri și hidroizolații de 15 ani. Cred în detaliul care se poate pune în operă.",
      location: "Iași",
      website: null,
      roleMain: "EXECUTANT" as const,
      subRole: "Constructor",
      verificationStatus: "VERIFIED" as const,
    },
    {
      key: "elena",
      address: "elena@detalia.dev",
      name: "Elena Dobre",
      headline: "Reprezentant tehnic — sisteme de termoizolație și etanșare.",
      location: "București",
      website: "https://exemplu.ro",
      roleMain: "FURNIZOR" as const,
      subRole: "Reprezentant tehnic",
      verificationStatus: "DECLARED" as const,
    },
  ];
  await db
    .insert(users)
    .values(
      userDefs.map((u) => ({
        email: u.address,
        name: u.name,
        status: "ACTIVE" as const,
        firstName: u.name.split(" ")[0],
        lastName: u.name.split(" ").slice(1).join(" "),
        headline: u.headline,
        location: u.location,
        website: u.website,
      })),
    )
    .onConflictDoNothing({ target: users.email });
  const userRows = await db.select({ id: users.id, email: users.email }).from(users);
  const uid = (key: string) => {
    const def = userDefs.find((u) => u.key === key)!;
    const r = userRows.find((u) => u.email === def.address);
    if (!r) throw new Error(`Userul ${key} lipsește.`);
    return r.id;
  };
  const roleSnap = (key: string) => {
    const u = userDefs.find((x) => x.key === key)!;
    return { roleMain: u.roleMain, subRole: u.subRole, verificationStatus: u.verificationStatus };
  };

  // Roluri (idempotent pe userId unic).
  await db
    .insert(roles)
    .values(
      userDefs.map((u) => ({
        userId: uid(u.key),
        roleMain: u.roleMain,
        subRole: u.subRole,
        verificationStatus: u.verificationStatus,
      })),
    )
    .onConflictDoNothing({ target: roles.userId });

  // Guard de idempotență: dacă Andrei are deja detalii, conținutul e seedat → ne oprim.
  const andreiId = uid("andrei");
  const existing = await db
    .select({ id: details.id })
    .from(details)
    .where(eq(details.authorId, andreiId))
    .limit(1);
  if (existing.length > 0) {
    console.log("Conținut demo deja seedat (Andrei are detalii) — skip.");
    process.exit(0);
  }

  // Detalii.
  const IMG = "/seed/detail.svg";
  const detailDefs = [
    { key: "d1", author: "andrei", cat: "acoperis", title: "Racord coș–învelitoare la șarpantă", desc: "Etanșarea trecerii coșului prin învelitoare, cu șorț și contrașorț. Greșeala clasică e lipsa contrașorțului.", days: 14 },
    { key: "d2", author: "andrei", cat: "anvelopa", title: "Punte termică la buiandrug", desc: "Întreruperea termosistemului la buiandrug — soluție cu fâșie de izolație pe glaf și armare suplimentară.", days: 40 },
    { key: "d3", author: "andrei", cat: "tamplarie", title: "Racord fereastră–perete (etanșare 3 planuri)", desc: "Etanșare interior/mijloc/exterior la golul de fereastră. Banda de comprimare pe conturul exterior.", days: 95 },
    { key: "d4", author: "andrei", cat: "fundatie", title: "Hidroizolare cuvă subsol", desc: "Hidroizolație tip cuvă la subsol sub nivelul pânzei freatice — racord radier-perete cu profil de oprire.", days: 210 },
    { key: "d5", author: "ioana", cat: "fundatie", title: "Racord fundație–elevație", desc: "Mustăți de armătură + hidroizolație orizontală la racordul fundație-elevație.", days: 8 },
    { key: "d6", author: "ioana", cat: "anvelopa", title: "Racord termosistem–soclu", desc: "Profil de soclu cu picurător, dublarea plasei la zona de impact mecanic.", days: 26 },
    { key: "d7", author: "mihai", cat: "acoperis", title: "Cornișă cu jgheab ascuns", desc: "Cornișă ventilată cu jgheab încastrat — atenție la panta de scurgere și la preaplin.", days: 5 },
    { key: "d8", author: "mihai", cat: "instalatii", title: "Trecere conductă prin perete structural", desc: "Manșon de trecere + etanșare elastică la traversarea unui perete de beton armat.", days: 33 },
    { key: "d9", author: "elena", cat: "finisaje", title: "Racord pardoseală–perete în zonă umedă", desc: "Scafă de etanșare + bandă de armare la racordul pardoseală-perete în baie.", days: 18 },
  ];
  const detailIdByKey = new Map<string, string>();
  for (const d of detailDefs) {
    const [row] = await db
      .insert(details)
      .values({
        title: d.title,
        description: d.desc,
        authorId: uid(d.author),
        categoryId: catId(d.cat),
        imageUrl: IMG,
        status: "PUBLISHED",
        createdAt: ago(d.days),
      })
      .returning({ id: details.id });
    detailIdByKey.set(d.key, row.id);
  }
  const detId = (key: string) => detailIdByKey.get(key)!;

  // Validări (poziție unică per user/țintă). Dezaprobările au justificare → devine comentariu.
  type V = { voter: string; detail: string; position: "APPROVE" | "DISAPPROVE"; days: number; justification?: string };
  const vDefs: V[] = [
    { voter: "mihai", detail: "d1", position: "APPROVE", days: 13 },
    { voter: "ioana", detail: "d1", position: "APPROVE", days: 12 },
    { voter: "elena", detail: "d1", position: "DISAPPROVE", days: 11, justification: "Șorțul propus nu acoperă suficient pe sub învelitoare — risc de infiltrație la ploaie cu vânt." },
    { voter: "mihai", detail: "d2", position: "APPROVE", days: 38 },
    { voter: "elena", detail: "d2", position: "APPROVE", days: 35 },
    { voter: "mihai", detail: "d3", position: "DISAPPROVE", days: 90, justification: "Banda de comprimare singură nu ține pe glaful neted — trebuie și profil de racord cu tencuiala." },
    { voter: "ioana", detail: "d4", position: "APPROVE", days: 205 },
    { voter: "andrei", detail: "d5", position: "APPROVE", days: 7 },
    { voter: "mihai", detail: "d5", position: "APPROVE", days: 6 },
    { voter: "andrei", detail: "d6", position: "DISAPPROVE", days: 24, justification: "Picurătorul de soclu e prea sus față de cota terenului amenajat — apa se întoarce spre fațadă." },
    { voter: "andrei", detail: "d7", position: "APPROVE", days: 4 },
    { voter: "ioana", detail: "d7", position: "APPROVE", days: 3 },
    { voter: "andrei", detail: "d8", position: "APPROVE", days: 30 },
    { voter: "andrei", detail: "d9", position: "APPROVE", days: 16 },
    { voter: "mihai", detail: "d9", position: "APPROVE", days: 15 },
  ];
  for (const v of vDefs) {
    const [vr] = await db
      .insert(validations)
      .values({
        userId: uid(v.voter),
        targetType: "DETAIL",
        targetId: detId(v.detail),
        position: v.position,
        roleSnapshot: roleSnap(v.voter),
        createdAt: ago(v.days),
      })
      .returning({ id: validations.id });
    if (v.position === "DISAPPROVE" && v.justification) {
      await db.insert(comments).values({
        targetType: "DETAIL",
        targetId: detId(v.detail),
        authorId: uid(v.voter),
        body: v.justification,
        originValidationId: vr.id,
        createdAt: ago(v.days),
      });
    }
  }

  // Comentarii Andrei împrăștiate pe an → densitate heatmap.
  const heatDays = [9, 21, 28, 52, 67, 80, 101, 119, 140, 165, 188, 205, 233, 260, 288, 305, 330, 350];
  const heatDetails = ["d5", "d6", "d7", "d8", "d9"];
  for (let i = 0; i < heatDays.length; i++) {
    await db.insert(comments).values({
      targetType: "DETAIL",
      targetId: detId(heatDetails[i % heatDetails.length]),
      authorId: andreiId,
      body: "Observație tehnică pe acest racord — merită discutată pe roluri.",
      createdAt: ago(heatDays[i]),
    });
  }

  // Schițe (teanc + ciornă pentru /sketches/drafts când ești logat ca Andrei).
  await db.insert(sketches).values([
    { detailId: detId("d5"), authorId: uid("mihai"), status: "PUBLISHED", thumbnailUrl: IMG, acceptedAt: ago(4), createdAt: ago(5) },
    { detailId: detId("d5"), authorId: uid("elena"), status: "PENDING_ACCEPTANCE", createdAt: ago(2) },
    { detailId: detId("d6"), authorId: andreiId, status: "DRAFT", createdAt: ago(1) },
  ]);

  console.log(
    `Seed demo: ${categoryDefs.length} categorii, ${userDefs.length} useri, ${detailDefs.length} detalii, ${vDefs.length} validări, schițe + heatmap.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed eșuat:", err);
    process.exit(1);
  });
