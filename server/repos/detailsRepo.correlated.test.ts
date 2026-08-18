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
