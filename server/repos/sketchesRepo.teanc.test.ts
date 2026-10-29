import { expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { details, sketches, users } = await import("@/db/schema");
const { getPublishedTeancSketch } = await import("./sketchesRepo");

// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("intoarce doar schita publicata din teancul detaliului, cu autorul retras mascat", async () => {
  const [author] = await db.insert(users).values({ name: "Autor real", email: "teanc@test.local" }).returning();
  const [detail, other] = await db
    .insert(details)
    .values([
      { title: "Detaliu", authorId: author.id },
      { title: "Alt detaliu", authorId: author.id },
    ])
    .returning();
  const base = { detailId: detail.id, authorId: author.id, status: "PUBLISHED" as const };
  const [published, removed, draft, annotation, hidden, elsewhere] = await db
    .insert(sketches)
    .values([
      base,
      { ...base, authorRemoved: true, roleSnapshot: { roleMain: "EXECUTANT", verificationStatus: "DECLARED" } },
      { ...base, status: "DRAFT" as const },
      { ...base, isAnnotation: true },
      { ...base, hiddenAfterRelease: true },
      { ...base, detailId: other.id },
    ])
    .returning();

  expect((await getPublishedTeancSketch(detail.id, published.id))?.authorName).toBe("Autor real");
  const masked = await getPublishedTeancSketch(detail.id, removed.id);
  expect(masked).toMatchObject({ authorName: null, authorId: "", authorRoleMain: "EXECUTANT" });
  for (const s of [draft, annotation, hidden, elsewhere]) {
    expect(await getPublishedTeancSketch(detail.id, s.id)).toBeNull();
  }
});
