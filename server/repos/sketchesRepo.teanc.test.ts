import { expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({ notifySketchDeleted: vi.fn(), notifySketchProposed: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail: vi.fn() }));
vi.mock("@/server/services/validationService", () => ({ recordSketchDisapproval: vi.fn() }));

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

// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("compune fallback-ul PDF din adnotare, fundal si foaia activa cand thumbnail-ul lipseste", async () => {
  const { getTeancSketch } = await import("@/server/services/sketchService");
  const [author] = await db.insert(users).values({ name: "Autor PDF", email: "print@test.local" }).returning();
  const [detail, other] = await db.insert(details).values([
    { title: "PDF", authorId: author.id }, { title: "Alt detaliu PDF", authorId: author.id },
  ]).returning();
  const stroke = (color: string) => [{ color, size: 4, points: [[0.2, 0.3]] }];
  const base = { detailId: detail.id, authorId: author.id, status: "PUBLISHED" as const };
  const [annotation, background, hidden, draft, elsewhere] = await db.insert(sketches).values([
    { ...base, isAnnotation: true, strokesJson: stroke("#111") },
    { ...base, authorRemoved: true, strokesJson: stroke("#222") },
    { ...base, hiddenAfterRelease: true, strokesJson: stroke("#333") },
    { ...base, status: "DRAFT" as const, strokesJson: stroke("#444") },
    { ...base, detailId: other.id, strokesJson: stroke("#555") },
  ]).returning();
  const [active, withThumbnail] = await db.insert(sketches).values([
    { ...base, strokesJson: stroke("#666"), baseSketchIds: [annotation.id, background.id, hidden.id, draft.id, elsewhere.id] },
    { ...base, strokesJson: stroke("#777"), thumbnailUrl: "https://store.test/thumb.jpg" },
  ]).returning();
  const result = await getTeancSketch(detail.id, active.id);
  expect(result?.printStrokes.map((s) => s.color)).toEqual(["#111", "#222", "#666"]);
  expect(result?.strokesJson).toEqual(stroke("#666"));
  expect((await getTeancSketch(detail.id, withThumbnail.id))?.printStrokes).toEqual([]);
  expect(await getTeancSketch(detail.id, elsewhere.id)).toBeNull();
});
