import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { comments, detailCategories, detailResources, details, sketches, validations } from "../db/schema";
import { addComment } from "../server/services/commentService";
import { createDetail, deleteDetail } from "../server/services/detailService";
import { approve } from "../server/services/validationService";
import { getSeed } from "./seed";

// Teste de INTEGRARE (handler-level omis — acestea acoperă service→repo pe DB real, nu mock-uri).
// Verifică exact ce mock-urile din unit tests ascund: atomicitatea scrierilor multi-tabel, cascada la
// ștergere, polimorfismul validare/comentariu pe SKETCH. Rulează pe DB-ul de preview/dev (proiectul
// `security`, fără browser — vezi playwright.config.ts).

test("createDetail: detaliul + categoriile + resursele se inserează atomic (insertDetailWithRelations)", async () => {
  const { testerUserId, categoryId } = getSeed();

  const res = await createDetail({
    authorId: testerUserId,
    title: `Integration test — detaliu ${Date.now()}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
    resources: [{ type: "LINK", url: "https://example.com" }],
  });

  expect(res.ok).toBe(true);
  if (!res.ok) return;

  try {
    const cats = await db
      .select({ categoryId: detailCategories.categoryId })
      .from(detailCategories)
      .where(eq(detailCategories.detailId, res.detailId));
    expect(cats).toHaveLength(1);
    expect(cats[0].categoryId).toBe(categoryId);

    const resources = await db
      .select({ url: detailResources.url })
      .from(detailResources)
      .where(eq(detailResources.detailId, res.detailId));
    expect(resources).toHaveLength(1);
    expect(resources[0].url).toBe("https://example.com");
  } finally {
    await db.delete(details).where(eq(details.id, res.detailId));
  }
});

test("deleteDetail: cascada șterge schița + validarea/comentariul polimorfice de pe ea", async () => {
  const { testerUserId, authorUserId, categoryId } = getSeed();

  // Detaliu deținut de `tester` (owner pentru ștergere), schiță autorată de `author`.
  const created = await createDetail({
    authorId: testerUserId,
    title: `Integration test — cascadă ${Date.now()}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
    resources: [],
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const detailId = created.detailId;

  const [sketch] = await db
    .insert(sketches)
    .values({ detailId, authorId: authorUserId, status: "PUBLISHED", strokesJson: [] })
    .returning({ id: sketches.id });

  // Polimorfism: validare + comentariu pe ținta SKETCH (nu DETAIL) — `tester` validează schița lui `author`.
  const validationRes = await approve({ userId: testerUserId, targetType: "SKETCH", targetId: sketch.id });
  expect(validationRes.ok).toBe(true);

  const commentRes = await addComment({
    userId: testerUserId,
    targetType: "SKETCH",
    targetId: sketch.id,
    body: "Comentariu de integrare pe schiță",
  });
  expect(commentRes.ok).toBe(true);

  const del = await deleteDetail({ detailId, userId: testerUserId });
  expect(del.ok).toBe(true);

  const remainingSketches = await db.select().from(sketches).where(eq(sketches.detailId, detailId));
  const remainingValidations = await db
    .select()
    .from(validations)
    .where(eq(validations.targetId, sketch.id));
  const remainingComments = await db.select().from(comments).where(eq(comments.targetId, sketch.id));
  const remainingDetail = await db.select().from(details).where(eq(details.id, detailId));

  expect(remainingSketches).toHaveLength(0);
  expect(remainingValidations).toHaveLength(0);
  expect(remainingComments).toHaveLength(0);
  expect(remainingDetail).toHaveLength(0);
});
