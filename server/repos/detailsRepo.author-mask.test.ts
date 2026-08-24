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
const { details, users, categories, detailCategories } = await import("@/db/schema");
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
});
