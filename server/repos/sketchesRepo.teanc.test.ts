import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/services/detailService", () => ({ getDetail: vi.fn() }));

const { db } = await import("@/db");
const { details, sketches, users } = await import("@/db/schema");
const { getPublishedTeancSketch } = await import("./sketchesRepo");

// "La hover peste un detaliu in feed sa fie o succesiune a schitelor din interiorul detaliului in loop"
// "un detaliu de proiect (projectId != null) NU apare NICIODATĂ pe nicio cale de citire PUBLICĂ"
it("citeste miniaturile publice ale paginii, fara ciorne, adnotari, foi ascunse sau proiecte", async () => {
  const { projects } = await import("@/db/schema");
  const { listFeedSketchPreviews } = await import("./sketchesRepo");
  const [author] = await db.insert(users).values({ email: "hover@test.local" }).returning();
  const [project] = await db.insert(projects).values({ name: "Privat", ownerId: author.id, inviteToken: crypto.randomUUID() }).returning();
  const [first, second, draft, privateDetail, outside] = await db.insert(details).values([
    { title: "Primul", authorId: author.id, status: "PUBLISHED" },
    { title: "Al doilea", authorId: author.id, status: "PUBLISHED" },
    { title: "Ciorna", authorId: author.id, status: "DRAFT" },
    { title: "Proiect", authorId: author.id, status: "PUBLISHED", projectId: project.id },
    { title: "Alta pagina", authorId: author.id, status: "PUBLISHED" },
  ]).returning();
  const base = { authorId: author.id, detailId: first.id, status: "PUBLISHED" as const, thumbnailUrl: "/preview.png" };
  const rows = await db.insert(sketches).values([
    { ...base, createdAt: new Date("2026-10-30T10:00:00Z") },
    { ...base, detailId: second.id, createdAt: new Date("2026-10-30T11:00:00Z") },
    { ...base, status: "DRAFT" }, { ...base, isAnnotation: true }, { ...base, hiddenAfterRelease: true },
    { ...base, detailId: privateDetail.id }, { ...base, detailId: draft.id }, { ...base, detailId: outside.id },
  ]).returning();
  const result = await listFeedSketchPreviews([first.id, second.id, draft.id, privateDetail.id]);
  expect(result.map((row) => row.id)).toEqual(rows.slice(0, 2).map((row) => row.id));
  expect(Object.keys(result[0]).sort()).toEqual(["detailId", "id", "thumbnailUrl"]);
  expect(await listFeedSketchPreviews([])).toEqual([]);
});

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
  const { getPrintStack } = await import("@/server/services/sketchService");
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
  const result = await getPrintStack(detail.id, undefined, active.id);
  expect(result?.printStrokes.map((s) => s.color)).toEqual(["#111", "#222", "#666"]);
  expect(result?.activeSketch?.strokesJson).toEqual(stroke("#666"));
  expect((await getPrintStack(detail.id, undefined, withThumbnail.id))?.printStrokes.map((s) => s.color)).toEqual(["#777"]);
  expect(await getPrintStack(detail.id, undefined, elsewhere.id)).toBeNull();
  // "Trebuie sa pot salva tot teancul la care privesc in momentul salvarii."
  expect((await getPrintStack(detail.id, [active.id], active.id))?.printStrokes.map((s) => s.color)).toEqual(["#666"]);
  expect((await getPrintStack(detail.id, [annotation.id, active.id], active.id))?.printStrokes.map((s) => s.color)).toEqual(["#111", "#666"]);
  expect((await getPrintStack(detail.id, [elsewhere.id, hidden.id, draft.id, background.id, active.id], active.id))?.printStrokes.map((s) => s.color)).toEqual(["#222", "#666"]);
  expect((await getPrintStack(detail.id, [annotation.id]))?.layers.map((layer) => layer.id)).toEqual([annotation.id]);
  expect(await getPrintStack(detail.id, [active.id, "invalid"], active.id)).toBeNull();
  expect(await getPrintStack(detail.id, [], active.id)).toBeNull();
});

// "Descrierea tuturor schitelor din teanc cu numele autorilor atasat langa descrieri"
// "Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras."
it("documentul include teancul vizibil real si notele lui, fara ciorne, foi ascunse sau identitati retrase", async () => {
  const { auth } = await import("@/lib/auth");
  const { getDetail } = await import("@/server/services/detailService");
  const { default: Page } = await import("@/app/(print)/details/[id]/sketch/[sketchId]/pdf/page");
  const [owner, artist, removed] = await db.insert(users).values([
    { name: "Autor baza PDF", email: "pdf-owner@test.local" },
    { name: "Autor doua schite", email: "pdf-artist@test.local" },
    { name: "Identitate retrasa secreta", email: "pdf-removed@test.local" },
  ]).returning();
  const [detail, other] = await db.insert(details).values([
    { title: "Document complet", authorId: owner.id }, { title: "Alt document", authorId: owner.id },
  ]).returning();
  const base = { detailId: detail.id, authorId: artist.id, status: "PUBLISHED" as const };
  const [active, another, retired] = await db.insert(sketches).values([
    { ...base, thumbnailUrl: "/pwa-192.png", note: "Explicatie activa" },
    { ...base, note: "Explicatie a doua" },
    { ...base, authorId: removed.id, authorRemoved: true, note: "Explicatie autor retras" },
    { ...base, status: "DRAFT" as const, note: "Nota ciornei ascunse" },
    { ...base, hiddenAfterRelease: true, note: "Nota foii ascunse" },
    { ...base, isAnnotation: true, note: "Nota adnotarii" },
    { ...base, detailId: other.id, note: "Nota altui detaliu" },
  ]).returning();
  vi.mocked(auth).mockResolvedValue({ user: { id: owner.id } } as never);
  vi.mocked(getDetail).mockResolvedValue({ ...detail, authorName: owner.name } as never);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: detail.id, sketchId: active.id }), searchParams: Promise.resolve({ stack: [another.id, retired.id, active.id].join(",") }) }));
  expect(html).toContain('src="/logo.svg"');
  expect(html).toContain("Autor baza PDF");
  const authorList = html.match(/<ul[^>]*>(.*?)<\/ul>/)![1];
  expect(authorList.match(/Autor doua schite/g)).toHaveLength(1);
  for (const note of ["Explicatie activa", "Explicatie a doua", "Explicatie autor retras"]) expect(html).toContain(note);
  expect(html.match(/<h3 /g)).toHaveLength(3);
  for (const hidden of ["Identitate retrasa secreta", "Nota ciornei ascunse", "Nota foii ascunse", "Nota adnotarii", "Nota altui detaliu"]) expect(html).not.toContain(hidden);
});

// "Tot teancul ... asa cum la Schiteaza ramane inghetat tot teancul deschis" — 20 fundaluri plus foaia activa.
it("permite exportul tuturor celor 21 de foi vizibile, fara a modifica limita de fundal la schitare", async () => {
  const { getPrintStack } = await import("@/server/services/sketchService");
  const [author] = await db.insert(users).values({ email: "print-full-stack@test.invalid" }).returning();
  const [detail] = await db.insert(details).values({ title: "Teanc complet", authorId: author.id }).returning();
  const base = { detailId: detail.id, authorId: author.id, status: "PUBLISHED" as const };
  const backgrounds = await db.insert(sketches).values(Array.from({ length: 20 }, () => base)).returning();
  const [active] = await db.insert(sketches).values({ ...base, baseSketchIds: backgrounds.map((s) => s.id) }).returning();
  const ids = [...backgrounds.map((s) => s.id), active.id];
  expect((await getPrintStack(detail.id, ids, active.id))?.layers).toHaveLength(21);
  expect(await getPrintStack(detail.id, [...ids, crypto.randomUUID()], active.id)).toBeNull();
});
