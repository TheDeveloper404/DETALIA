import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Rulează SQL-ul real (PGlite), NU mock-uiește repo-ul — spre deosebire de restul testelor de service.
// Motiv: bug-ul recidivat de 3 ori în acest fișier (2026-07-23, 2026-07-31, 2026-08-06 — vezi comentariul
// de la `validationCount`/`commentCount`/`sketchCount` din detailsRepo.ts) e o corelare de subquery
// greșită care NU aruncă eroare SQL — un test care mock-uiește repo-ul nu poate prinde asta niciodată,
// indiferent cât de bine acoperă regulile de business.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { details, users, validations, comments, sketches } = await import("@/db/schema");
const { listFeed } = await import("./detailsRepo");

async function makeUser(email: string) {
  const [row] = await db.insert(users).values({ email }).returning({ id: users.id });
  return row.id;
}

describe("listFeed — counts de interacțiune (subquery corelat pe details.id)", () => {
  let authorA: string;
  let authorB: string;
  let detailA: string;
  let detailB: string;

  beforeAll(async () => {
    authorA = await makeUser("author-a@test.local");
    authorB = await makeUser("author-b@test.local");
    const voterA1 = await makeUser("voter-a1@test.local");
    const voterA2 = await makeUser("voter-a2@test.local");
    const voterB1 = await makeUser("voter-b1@test.local");

    const [rowA] = await db
      .insert(details)
      .values({ title: "Detaliu A", authorId: authorA })
      .returning({ id: details.id });
    detailA = rowA.id;
    const [rowB] = await db
      .insert(details)
      .values({ title: "Detaliu B", authorId: authorB })
      .returning({ id: details.id });
    detailB = rowB.id;

    // A: 2 validări, 1 comentariu, 1 schiță. B: 1 validare, 0 comentarii, 0 schițe — dacă subquery-ul
    // se corelează greșit (ex. la id-ul propriului subquery, sau la TOATE rândurile), fie B ar prelua
    // interacțiunile lui A, fie ambele ar ieși 0, fie ambele ar ieși egale cu totalul global (3).
    await db.insert(validations).values([
      { userId: voterA1, targetType: "DETAIL", targetId: detailA, position: "APPROVE" },
      { userId: voterA2, targetType: "DETAIL", targetId: detailA, position: "APPROVE" },
      { userId: voterB1, targetType: "DETAIL", targetId: detailB, position: "APPROVE" },
    ]);
    await db.insert(comments).values([
      { targetType: "DETAIL", targetId: detailA, authorId: voterA1, body: "Comentariu pe A" },
    ]);
    await db.insert(sketches).values([
      { detailId: detailA, authorId: voterA1, status: "PUBLISHED" },
    ]);
  });

  afterAll(async () => {
    await db.delete(sketches);
    await db.delete(comments);
    await db.delete(validations);
    await db.delete(details);
    await db.delete(users);
  });

  it("numără corect per detaliu, fără să amestece interacțiunile între detalii diferite", async () => {
    const rows = await listFeed({ limit: 10 });
    const a = rows.find((r) => r.id === detailA)!;
    const b = rows.find((r) => r.id === detailB)!;

    expect(a.validationCount).toBe(2);
    expect(a.commentCount).toBe(1);
    expect(a.sketchCount).toBe(1);

    expect(b.validationCount).toBe(1);
    expect(b.commentCount).toBe(0);
    expect(b.sketchCount).toBe(0);
  });
});

describe("listFeed — validationCount însumează detaliul de bază + schițele din teanc (2026-08-26, decizie de produs: valoarea vine din toată dezbaterea)", () => {
  let detailA: string;
  let detailB: string;

  beforeAll(async () => {
    const authorA = await makeUser("author-agg-a@test.local");
    const authorB = await makeUser("author-agg-b@test.local");
    const v1 = await makeUser("agg-v1@test.local");
    const v2 = await makeUser("agg-v2@test.local");
    const v3 = await makeUser("agg-v3@test.local");
    const v4 = await makeUser("agg-v4@test.local");
    const v5 = await makeUser("agg-v5@test.local");
    const v6 = await makeUser("agg-v6@test.local");
    const v7 = await makeUser("agg-v7@test.local");

    const [rowA] = await db
      .insert(details)
      .values({ title: "Detaliu agregare A", authorId: authorA })
      .returning({ id: details.id });
    detailA = rowA.id;
    const [rowB] = await db
      .insert(details)
      .values({ title: "Detaliu agregare B", authorId: authorB })
      .returning({ id: details.id });
    detailB = rowB.id;

    const [sketchPublished1] = await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: v1, status: "PUBLISHED" })
      .returning({ id: sketches.id });
    const [sketchPublished2] = await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: v1, status: "PUBLISHED" })
      .returning({ id: sketches.id });
    // NU trebuie să intre în sumă: schiță nepublicată (draft, nu e încă „în teanc").
    const [sketchDraft] = await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: v1, status: "DRAFT" })
      .returning({ id: sketches.id });
    // NU trebuie să intre în sumă: adnotare (nu e un tab separat în teanc — vezi `sketchCount`).
    const [sketchAnnotation] = await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: v1, status: "PUBLISHED", isAnnotation: true })
      .returning({ id: sketches.id });
    // NU trebuie să intre în sumă: schiță pe ALT detaliu (fără scurgere cross-detail).
    const [sketchOnB] = await db
      .insert(sketches)
      .values({ detailId: detailB, authorId: v1, status: "PUBLISHED" })
      .returning({ id: sketches.id });

    await db.insert(validations).values([
      // Detaliul A de bază: 1 aprobare + 1 dezaprobare.
      { userId: v1, targetType: "DETAIL", targetId: detailA, position: "APPROVE" },
      { userId: v2, targetType: "DETAIL", targetId: detailA, position: "DISAPPROVE" },
      // sketchPublished1: 2 aprobări.
      { userId: v3, targetType: "SKETCH", targetId: sketchPublished1.id, position: "APPROVE" },
      { userId: v4, targetType: "SKETCH", targetId: sketchPublished1.id, position: "APPROVE" },
      // sketchPublished2: 1 dezaprobare.
      { userId: v5, targetType: "SKETCH", targetId: sketchPublished2.id, position: "DISAPPROVE" },
      // Exclus din suma lui A: draft + adnotare pe A.
      { userId: v6, targetType: "SKETCH", targetId: sketchDraft.id, position: "APPROVE" },
      { userId: v6, targetType: "SKETCH", targetId: sketchAnnotation.id, position: "APPROVE" },
      // Detaliul B — propriile 2 validări (detaliu + propria schiță), control că nu se scurg în A ȘI
      // că B își însumează corect PROPRIA schiță (nu doar A e testat pentru agregare).
      { userId: v7, targetType: "SKETCH", targetId: sketchOnB.id, position: "APPROVE" },
      { userId: v7, targetType: "DETAIL", targetId: detailB, position: "APPROVE" },
    ]);
  });

  afterAll(async () => {
    await db.delete(validations);
    await db.delete(sketches);
    await db.delete(details);
    await db.delete(users);
  });

  it("sumează aprob+dezaprob pe detaliu + schițele PUBLISHED ne-adnotare, exclude draft/adnotare/alt detaliu", async () => {
    const rows = await listFeed({ limit: 10 });
    const a = rows.find((r) => r.id === detailA)!;
    const b = rows.find((r) => r.id === detailB)!;

    // A: 1+1 (detaliu) + 2 (sketch1) + 1 (sketch2) = 5. Draft/adnotare/B excluse.
    expect(a.validationCount).toBe(5);

    // B: propria validare pe detaliu + propria schiță (1+1=2) — nimic din A nu se scurge aici.
    expect(b.validationCount).toBe(2);
  });
});

describe("listFeed — interactorAvatars/interactorCount: orice interacțiune, o poză per user, exclude autor + ascunse (2026-08-27, Liviu+Edi)", () => {
  let detailA: string;

  beforeAll(async () => {
    const authorA = await makeUser("interactor-author@test.local");
    // Interacționează prin DOUĂ căi (validare pe detaliu + comentariu) — trebuie să apară O SINGURĂ dată.
    const dupUser = await makeUser("interactor-dup@test.local");
    // Doar comentariu, nimic altceva.
    const commentOnly = await makeUser("interactor-comment-only@test.local");
    // Doar autor de schiță publicată, nicio validare/comentariu.
    const sketchAuthorOnly = await makeUser("interactor-sketch-only@test.local");
    // Doar validare pe o SCHIȚĂ a detaliului (nu pe detaliul de bază).
    const sketchVoter = await makeUser("interactor-sketch-voter@test.local");
    // Ascuns pe detaliu + ascuns pe schiță — SEC-001/002, nu trebuie să apară.
    const hiddenDetailVoter = await makeUser("interactor-hidden-detail@test.local");
    const hiddenSketchCommenter = await makeUser("interactor-hidden-sketch@test.local");

    const [rowA] = await db
      .insert(details)
      .values({ title: "Detaliu interacțiuni", authorId: authorA })
      .returning({ id: details.id });
    detailA = rowA.id;

    const [sk1] = await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: sketchAuthorOnly, status: "PUBLISHED" })
      .returning({ id: sketches.id });
    // Schiță ascunsă (hiddenAfterRelease) — autorul ei NU trebuie să apară.
    await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: hiddenSketchCommenter, status: "PUBLISHED", hiddenAfterRelease: true });
    // Schiță DRAFT — autorul ei NU intră (nu e „în teanc").
    await db
      .insert(sketches)
      .values({ detailId: detailA, authorId: commentOnly, status: "DRAFT" });

    await db.insert(validations).values([
      { userId: dupUser, targetType: "DETAIL", targetId: detailA, position: "APPROVE" },
      { userId: sketchVoter, targetType: "SKETCH", targetId: sk1.id, position: "DISAPPROVE" },
      { userId: authorA, targetType: "DETAIL", targetId: detailA, position: "APPROVE" }, // autorul votează propriul detaliu — exclus
      {
        userId: hiddenDetailVoter,
        targetType: "DETAIL",
        targetId: detailA,
        position: "APPROVE",
        hiddenAfterRelease: true,
      },
    ]);
    await db.insert(comments).values([
      { targetType: "DETAIL", targetId: detailA, authorId: dupUser, body: "a doua cale de interacțiune a lui dupUser" },
      { targetType: "DETAIL", targetId: detailA, authorId: commentOnly, body: "doar comentariu" },
      { targetType: "DETAIL", targetId: detailA, authorId: authorA, body: "autorul comentează propriul detaliu — exclus" },
      {
        targetType: "DETAIL",
        targetId: detailA,
        authorId: hiddenSketchCommenter,
        body: "comentariu ascuns",
        hiddenAfterRelease: true,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(comments);
    await db.delete(validations);
    await db.delete(sketches);
    await db.delete(details);
    await db.delete(users);
  });

  it("numără userii distincți care au interacționat (dedupe, fără autor, fără ascunse)", async () => {
    const rows = await listFeed({ limit: 10 });
    const a = rows.find((r) => r.id === detailA)!;

    // dupUser + commentOnly + sketchAuthorOnly + sketchVoter = 4. Autorul, ascunsele (validare + comentariu
    // + schiță) și DRAFT-ul sunt excluse. dupUser apare O DATĂ deși are 2 interacțiuni.
    expect(a.interactorCount).toBe(4);
    expect(a.interactorAvatars).toHaveLength(4);
  });
});

describe("listFeed — createdAt identic → details.id ca tiebreaker (ordine stabilă)", () => {
  let detailX: string;
  let detailY: string;

  beforeAll(async () => {
    const author = await makeUser("author-tiebreak@test.local");
    // createdAt IDENTIC pe ambele — fără tiebreaker, Postgres nu garantează ordinea între cereri
    // LIMIT/OFFSET diferite pentru rânduri cu aceeași valoare de sortare.
    const tiedAt = new Date("2026-01-01T00:00:00.000Z");
    const [rowX] = await db
      .insert(details)
      .values({ title: "Detaliu X", authorId: author, createdAt: tiedAt })
      .returning({ id: details.id });
    detailX = rowX.id;
    const [rowY] = await db
      .insert(details)
      .values({ title: "Detaliu Y", authorId: author, createdAt: tiedAt })
      .returning({ id: details.id });
    detailY = rowY.id;
  });

  afterAll(async () => {
    await db.delete(details);
    await db.delete(users);
  });

  it("ordonează după details.id (desc) când createdAt e egal, identic la cereri repetate", async () => {
    const first = (await listFeed({ limit: 10 })).map((r) => r.id);
    const second = (await listFeed({ limit: 10 })).map((r) => r.id);
    expect(first).toEqual(second);

    const posX = first.indexOf(detailX);
    const posY = first.indexOf(detailY);
    expect(posX).toBeGreaterThanOrEqual(0);
    expect(posY).toBeGreaterThanOrEqual(0);

    const expectedFirst = detailX > detailY ? detailX : detailY;
    expect(first[Math.min(posX, posY)]).toBe(expectedFirst);
  });
});

describe("listFeed — filtru unanswered (0 schițe ȘI 0 validări; comentariile nu contează)", () => {
  let dNimic: string; // 0 schițe, 0 validări, 0 comentarii
  let dDoarComentariu: string; // 0 schițe, 0 validări, 1 comentariu → TOT „fără răspuns"
  let dCuSchita: string; // 1 schiță → NU
  let dCuValidare: string; // 1 validare → NU
  let dSchitaAscunsa: string; // 1 schiță hiddenAfterRelease → NU se numără → TOT „fără răspuns"

  beforeAll(async () => {
    const a = await makeUser("ua-unans@test.local");
    const other = await makeUser("uo-unans@test.local");
    const mk = async (title: string) => {
      const [r] = await db.insert(details).values({ title, authorId: a }).returning({ id: details.id });
      return r.id;
    };
    dNimic = await mk("Neatins");
    dDoarComentariu = await mk("Doar comentariu");
    dCuSchita = await mk("Cu schiță");
    dCuValidare = await mk("Cu validare");
    dSchitaAscunsa = await mk("Schiță ascunsă");

    await db.insert(comments).values([
      { targetType: "DETAIL", targetId: dDoarComentariu, authorId: other, body: "un comentariu" },
    ]);
    await db.insert(sketches).values([
      { detailId: dCuSchita, authorId: other, status: "PUBLISHED" },
      // hiddenAfterRelease → invizibilă comunității → NU se numără în sketchCount (Greptile PR #272).
      { detailId: dSchitaAscunsa, authorId: other, status: "PUBLISHED", hiddenAfterRelease: true },
    ]);
    await db.insert(validations).values([
      { userId: other, targetType: "DETAIL", targetId: dCuValidare, position: "APPROVE" },
    ]);
  });

  afterAll(async () => {
    await db.delete(sketches);
    await db.delete(comments);
    await db.delete(validations);
    await db.delete(details);
    await db.delete(users);
  });

  it("întoarce DOAR detaliile cu 0 schițe VIZIBILE ȘI 0 validări (comentariul + schița ascunsă nu le exclud)", async () => {
    const ids = (await listFeed({ limit: 50, unanswered: true })).map((r) => r.id);
    expect(ids).toContain(dNimic);
    expect(ids).toContain(dDoarComentariu);
    expect(ids).toContain(dSchitaAscunsa); // schița e hiddenAfterRelease → nu se numără
    expect(ids).not.toContain(dCuSchita);
    expect(ids).not.toContain(dCuValidare);
  });

  it("schița hiddenAfterRelease nu intră în sketchCount", async () => {
    const rows = await listFeed({ limit: 50 });
    expect(rows.find((r) => r.id === dSchitaAscunsa)!.sketchCount).toBe(0);
    expect(rows.find((r) => r.id === dCuSchita)!.sketchCount).toBe(1);
  });

  it("fără filtru le întoarce pe toate 5 (filtrul nu se aplică implicit)", async () => {
    const ids = (await listFeed({ limit: 50 })).map((r) => r.id);
    for (const id of [dNimic, dDoarComentariu, dCuSchita, dCuValidare, dSchitaAscunsa]) {
      expect(ids).toContain(id);
    }
  });
});
