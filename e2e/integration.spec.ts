import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { commentLikes, comments, detailCategories, detailResources, details, sketches, validations } from "../db/schema";
import { addComment, getComments, toggleCommentLike } from "../server/services/commentService";
import { createDetail, deleteDetail, getFeed } from "../server/services/detailService";
import { approve, disapprove } from "../server/services/validationService";
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

test("toggleCommentLike: vot up/down real pe DB + CANNOT_LIKE_OWN + cascadă la ștergerea comentariului", async () => {
  const { testerUserId, authorUserId, categoryId } = getSeed();

  const created = await createDetail({
    authorId: testerUserId,
    title: `Integration test — vot comentariu ${Date.now()}`,
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
      body: "Comentariu de integrare — vot",
    });
    expect(commentRes.ok).toBe(true);

    const [comment] = await db.select({ id: comments.id }).from(comments).where(eq(comments.targetId, detailId));

    // Autorul nu-și poate vota propriul comentariu (CANNOT_LIKE_OWN, enforce în service).
    const ownVote = await toggleCommentLike({ userId: testerUserId, commentId: comment.id, direction: "UP" });
    expect(ownVote).toEqual({ ok: false, error: "CANNOT_LIKE_OWN" });

    // `author` apreciază comentariul lui `tester` → toggle real pe tabelul comment_likes (direction UP).
    const liked = await toggleCommentLike({ userId: authorUserId, commentId: comment.id, direction: "UP" });
    expect(liked).toEqual({ ok: true, myVote: "UP" });

    const rowsAfterLike = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(rowsAfterLike).toHaveLength(1);
    expect(rowsAfterLike[0].direction).toBe("UP");

    // Agregarea din listCommentsForTarget (upvoteCount/downvoteCount/myVote/likers) reflectă votul.
    const listedForAuthor = await getComments("DETAIL", detailId, authorUserId);
    const listed = listedForAuthor.find((c) => c.id === comment.id);
    expect(listed?.upvoteCount).toBe(1);
    expect(listed?.downvoteCount).toBe(0);
    expect(listed?.myVote).toBe("UP");
    expect(listed?.likers).toHaveLength(1);
    expect(listed?.likers[0]).toMatchObject({ id: authorUserId });

    // Din perspectiva altcuiva (tester), myVote e null — poziția e per-user.
    const listedForTester = await getComments("DETAIL", detailId, testerUserId);
    expect(listedForTester.find((c) => c.id === comment.id)?.myVote).toBeNull();

    // Comutare pe DOWN — un singur rând rămâne, direcția se schimbă (nu se dublează poziția).
    const switched = await toggleCommentLike({ userId: authorUserId, commentId: comment.id, direction: "DOWN" });
    expect(switched).toEqual({ ok: true, myVote: "DOWN" });
    const rowsAfterSwitch = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(rowsAfterSwitch).toHaveLength(1);
    expect(rowsAfterSwitch[0].direction).toBe("DOWN");

    // Retragere — toggle din nou pe DOWN → myVote: null, rândul dispare.
    const unvoted = await toggleCommentLike({ userId: authorUserId, commentId: comment.id, direction: "DOWN" });
    expect(unvoted).toEqual({ ok: true, myVote: null });
    const rowsAfterUnvote = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(rowsAfterUnvote).toHaveLength(0);

    // Cascadă: ștergerea detaliului (→ șterge comentariul) elimină și un vot rămas.
    await toggleCommentLike({ userId: authorUserId, commentId: comment.id, direction: "UP" }); // re-votează
    await deleteDetail({ detailId, userId: testerUserId });
    const remainingVotes = await db.select().from(commentLikes).where(eq(commentLikes.commentId, comment.id));
    expect(remainingVotes).toHaveLength(0);
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
    const row = feed.details.find((d) => d.id === detailId);
    expect(row).toBeDefined();
    // Dacă bug-ul de corelare revine, contoarele cad silențios la 0 — nu la o eroare.
    expect(row?.commentCount).toBe(1);
    expect(row?.validationCount).toBe(1);
    // `approveCount` (2026-08-16): DOAR aprobările — subquery corelat separat, aceeași clasă de bug.
    expect(row?.approveCount).toBe(1);
  } finally {
    await db.delete(comments).where(eq(comments.targetId, detailId));
    await db.delete(validations).where(eq(validations.targetId, detailId));
    await db.delete(details).where(eq(details.id, detailId));
  }
});

// `approveCount` (2026-08-16, feed card fără vot inline — vezi CHANGELOG): trebuie să numere DOAR
// aprobările, nu totalul aprob+dezaprob (`validationCount`) — altfel, lângă săgeata-sus din card, un
// total combinat ar sugera vizual că toate pozițiile sunt aprobări.
test("getFeed: approveCount numără DOAR aprobările, validationCount rămâne totalul combinat", async () => {
  const { testerUserId, authorUserId, categoryId } = getSeed();

  const created = await createDetail({
    authorId: testerUserId,
    title: `Integration test — approveCount ${Date.now()}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const detailId = created.detailId;

  try {
    await disapprove({
      userId: authorUserId,
      targetType: "DETAIL",
      targetId: detailId,
      justification: "Integration test — dezaprobare pentru approveCount.",
    });

    const feed = await getFeed({ q: "approveCount" });
    const row = feed.details.find((d) => d.id === detailId);
    expect(row).toBeDefined();
    expect(row?.validationCount).toBe(1);
    expect(row?.approveCount).toBe(0);
  } finally {
    await db.delete(comments).where(eq(comments.targetId, detailId));
    await db.delete(validations).where(eq(validations.targetId, detailId));
    await db.delete(details).where(eq(details.id, detailId));
  }
});

// Căutarea folosește `ILIKE`, care compară caractere literal — fără fold explicit, un termen fără
// diacritice nu găsește un titlu cu diacritice (și invers). Testat contra DB real (nu mock): fold-ul
// se face cu `translate()` direct în SQL, comportament de Postgres, nu de aplicație.
test("getFeed: căutarea e insensibilă la diacritice (ambele direcții)", async () => {
  const { testerUserId, categoryId } = getSeed();
  const tag = Date.now();

  const created = await createDetail({
    authorId: testerUserId,
    title: `Poartă metalică țeavă zincată ${tag}`,
    categoryIds: [categoryId],
    imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const detailId = created.detailId;

  try {
    // Termen FĂRĂ diacritice → găsește titlul CU diacritice.
    const byPlain = await getFeed({ q: `Poarta metalica ${tag}` });
    expect(byPlain.details.find((d) => d.id === detailId)).toBeDefined();

    // Termen CU diacritice (variantă sedilă) → găsește tot.
    const byDiacritic = await getFeed({ q: `ţeavă zincată ${tag}` });
    expect(byDiacritic.details.find((d) => d.id === detailId)).toBeDefined();
  } finally {
    await db.delete(details).where(eq(details.id, detailId));
  }
});
