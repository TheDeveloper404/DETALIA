import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { commentLikes, comments, detailCategories, detailResources, details, sketches, validations } from "../db/schema";
import { addComment, getComments, toggleCommentLike } from "../server/services/commentService";
import { createDetail, deleteDetail, getFeed } from "../server/services/detailService";
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

  // Detaliu deținut de `tester`, schiță autorată tot de `tester` — dacă schița ar fi a lui `author`,
  // countDetailInteractions ar detecta o interacțiune de la altcineva și deleteDetail ar anonimiza în
  // loc să șteargă cascadă (decizie de produs 2026-08-06, server/services/detailService.ts:444-461).
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
    .values({ detailId, authorId: testerUserId, status: "PUBLISHED", strokesJson: [] })
    .returning({ id: sketches.id });

  // Polimorfism: validare + comentariu pe ținta SKETCH (nu DETAIL) — `author` ia poziție/comentează pe
  // schița lui `tester` (nu contează pentru countDetailInteractions, care numără doar ținte DETAIL și
  // sketchesFromOthers).
  const validationRes = await approve({ userId: authorUserId, targetType: "SKETCH", targetId: sketch.id });
  expect(validationRes.ok).toBe(true);

  const commentRes = await addComment({
    userId: authorUserId,
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

test("toggleCommentLike: toggle real pe DB + CANNOT_LIKE_OWN + cascadă la ștergerea comentariului", async () => {
  const { testerUserId, authorUserId, categoryId } = getSeed();

  const created = await createDetail({
    authorId: testerUserId,
    title: `Integration test — like comentariu ${Date.now()}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
    resources: [],
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const detailId = created.detailId;

  try {
    // Comentariu al lui `tester` (owner-ul detaliului) pe propriul detaliu — dacă ar fi al lui `author`,
    // countDetailInteractions l-ar număra ca interacțiune de la altcineva și deleteDetail ar anonimiza
    // în loc să șteargă cascadă (decizie de produs 2026-08-06, server/services/detailService.ts:444-461).
    const commentRes = await addComment({
      userId: testerUserId,
      targetType: "DETAIL",
      targetId: detailId,
      body: "Comentariu de integrare — like",
    });
    expect(commentRes.ok).toBe(true);

    const [comment] = await db.select({ id: comments.id }).from(comments).where(eq(comments.targetId, detailId));

    // Autorul nu-și poate aprecia propriul comentariu (CANNOT_LIKE_OWN, enforce în service).
    const ownLike = await toggleCommentLike({ userId: testerUserId, commentId: comment.id });
    expect(ownLike).toEqual({ ok: false, error: "CANNOT_LIKE_OWN" });

    // `author` apreciază comentariul lui `tester` → toggle real pe tabelul comment_likes.
    const liked = await toggleCommentLike({ userId: authorUserId, commentId: comment.id });
    expect(liked).toEqual({ ok: true, liked: true });

    const rowsAfterLike = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(rowsAfterLike).toHaveLength(1);

    // Agregarea din listCommentsForTarget (likeCount/likedByMe/likers) reflectă like-ul.
    const listedForAuthor = await getComments("DETAIL", detailId, authorUserId);
    const listed = listedForAuthor.find((c) => c.id === comment.id);
    expect(listed?.likeCount).toBe(1);
    expect(listed?.likedByMe).toBe(true);
    expect(listed?.likers).toHaveLength(1);
    expect(listed?.likers[0]).toMatchObject({ id: authorUserId });

    // Din perspectiva altcuiva (tester), likedByMe e fals — poziția e per-user.
    const listedForTester = await getComments("DETAIL", detailId, testerUserId);
    expect(listedForTester.find((c) => c.id === comment.id)?.likedByMe).toBe(false);

    // Retragere — toggle din nou → liked: false, rândul dispare.
    const unliked = await toggleCommentLike({ userId: authorUserId, commentId: comment.id });
    expect(unliked).toEqual({ ok: true, liked: false });
    const rowsAfterUnlike = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(rowsAfterUnlike).toHaveLength(0);

    // Cascadă: ștergerea detaliului (→ șterge comentariul) elimină și un like rămas.
    await toggleCommentLike({ userId: authorUserId, commentId: comment.id }); // re-apreciază
    await deleteDetail({ detailId, userId: testerUserId });
    const remainingLikes = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(remainingLikes).toHaveLength(0);
  } finally {
    await db.delete(details).where(eq(details.id, detailId));
  }
});

// Regresie CRITICĂ (găsit la debugging manual, 2026-08-06 — verificat direct pe date de producție,
// unde un detaliu cu 5 comentarii reale întorcea commentCount: 0): fără calificare explicită a
// coloanei `details.id` în subquery-urile corelate din `detailsRepo.ts` (commentCount/validationCount/
// sketchCount), Postgres rezolvă identificatorul necalificat la coloana `id` a SUBQUERY-ULUI (toate
// tabelele au o coloană `id`), nu la `details.id` din exterior — corelarea devine `comments.target_id
// = comments.id`, aproape mereu FALS. Testele unitare (mock-uite) nu puteau prinde asta — doar SQL
// real, pe DB real, o poate verifica. A afectat feed-ul ÎNTREG (contoare greșite) și sortarea „cele
// mai dezbătute" (interactionScore mereu 0 pentru toți).
test("getFeed: comentariul/validarea/schița ALTCUIVA se numără corect în contoare (nu 0)", async () => {
  const { testerUserId, authorUserId, categoryId } = getSeed();

  const created = await createDetail({
    authorId: testerUserId,
    title: `Integration test — contoare ${Date.now()}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const detailId = created.detailId;

  try {
    // Interacțiunea vine de la ALTCINEVA (authorUserId), ca în scenariul care a expus bug-ul.
    await addComment({
      userId: authorUserId,
      targetType: "DETAIL",
      targetId: detailId,
      body: "Integration test — comentariu de la altcineva.",
    });
    await approve({ userId: authorUserId, targetType: "DETAIL", targetId: detailId });

    const feed = await getFeed({ q: "contoare" });
    const row = feed.find((d) => d.id === detailId);
    expect(row).toBeDefined();
    // Dacă bug-ul de corelare revine, ambele contoare cad silențios la 0 — nu la o eroare.
    expect(row?.commentCount).toBe(1);
    expect(row?.validationCount).toBe(1);
  } finally {
    await db.delete(comments).where(eq(comments.targetId, detailId));
    await db.delete(validations).where(eq(validations.targetId, detailId));
    await db.delete(details).where(eq(details.id, detailId));
  }
});
