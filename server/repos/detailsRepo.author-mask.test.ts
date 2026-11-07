import { describe, expect, it, vi } from "vitest";

// `authorId` expus de `listTopDebated`/`listRelatedDetails` (rail-ul „cele mai dezbătute" + „Detalii
// înrudite") trebuie mascat la fel ca în `detailWithAuthorColumns` — un autor RETRAS (anonymizedAt
// setat) nu are voie să lase un id deschidabil ca /profile/<id> pe nicio cale de citire publică,
// altfel retragerea identității ar fi decorativă (vezi comentariul din detailsRepo.ts).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const { db } = await createTestDb();
  return { db };
});

const { db } = await import("@/db");
const { details, users, categories, detailCategories, comments, validations } = await import("@/db/schema");
const { listTopDebated, listRelatedDetails } = await import("./detailsRepo");

async function makeUser(email: string) {
  const [row] = await db.insert(users).values({ email }).returning({ id: users.id });
  return row.id;
}

describe("authorId mascat pe autor retras — listTopDebated / listRelatedDetails", () => {
  it("detaliu normal → authorId real; detaliu cu autor retras → authorId null", async () => {
    const normalAuthor = await makeUser("mask-normal@test.local");
    const withdrawnAuthor = await makeUser("mask-withdrawn@test.local");

    const [category] = await db
      .insert(categories)
      .values({ name: "Test mascare", slug: `test-mascare-${Date.now()}` })
      .returning({ id: categories.id });

    const [normalDetail] = await db
      .insert(details)
      .values({ title: "Detaliu normal", authorId: normalAuthor, status: "PUBLISHED" })
      .returning({ id: details.id });
    const [withdrawnDetail] = await db
      .insert(details)
      .values({
        title: "Detaliu cu autor retras",
        authorId: withdrawnAuthor,
        status: "PUBLISHED",
        anonymizedAt: new Date(),
        authorRoleSnapshot: { roleMain: "ANTREPRENOR", subRole: null, verificationStatus: "UNVERIFIED" },
      })
      .returning({ id: details.id });

    await db.insert(detailCategories).values([
      { detailId: normalDetail.id, categoryId: category.id },
      { detailId: withdrawnDetail.id, categoryId: category.id },
    ]);

    const debated = await listTopDebated(10);
    const normalRow = debated.find((d) => d.id === normalDetail.id);
    const withdrawnRow = debated.find((d) => d.id === withdrawnDetail.id);
    expect(normalRow?.authorId).toBe(normalAuthor);
    expect(withdrawnRow?.authorId).toBeNull();
    expect(withdrawnRow?.authorName).toBeNull();

    // „Detalii înrudite" pt normalDetail — categoria comună include și withdrawnDetail.
    const related = await listRelatedDetails({
      detailId: normalDetail.id,
      categoryIds: [category.id],
      limit: 10,
    });
    const relatedWithdrawn = related.find((r) => r.id === withdrawnDetail.id);
    expect(relatedWithdrawn?.authorId).toBeNull();
  });

  // Regula aprobata: "Afisez top 5 global dupa numarul de comentarii, descrescator; la egalitate, cele mai noi primele."
  it("topul de 5 foloseste comentariile vizibile, nu validarile, si departajeaza dupa data", async () => {
    const authorId = await makeUser("debated-order@test.local");
    const rows = await db.insert(details).values(
      Array.from({ length: 7 }, (_, i) => ({
        title: `Top dezbatere ${i}`,
        authorId,
        status: i === 6 ? "DRAFT" : "PUBLISHED",
        createdAt: new Date(`2026-01-0${i + 1}T12:00:00Z`),
      })),
    ).returning({ id: details.id });
    const counts = [1, 6, 5, 4, 3, 3, 20];
    await db.insert(comments).values(rows.flatMap((row, i) =>
      Array.from({ length: counts[i] }, () => ({
        targetType: "DETAIL" as const, targetId: row.id, authorId, body: "Comentariu vizibil",
      })),
    ));
    await db.insert(comments).values(Array.from({ length: 20 }, () => ({
      targetType: "DETAIL" as const, targetId: rows[0].id, authorId,
      body: "Comentariu ascuns", hiddenAfterRelease: true,
    })));
    const voters = await db.insert(users).values(Array.from({ length: 10 }, (_, i) => ({
      email: `debated-voter-${i}@test.local`,
    }))).returning({ id: users.id });
    await db.insert(validations).values(voters.map((voter) => ({
      userId: voter.id, targetType: "DETAIL" as const, targetId: rows[0].id, position: "APPROVE" as const,
    })));

    const top = await listTopDebated(5);
    expect(top.map((d) => d.id)).toEqual([rows[1].id, rows[2].id, rows[3].id, rows[5].id, rows[4].id]);
    expect(top.map((d) => d.commentCount)).toEqual([6, 5, 4, 3, 3]);
  });
});
