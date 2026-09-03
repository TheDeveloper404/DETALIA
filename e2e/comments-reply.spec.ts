import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";

import { db } from "../db";
import { comments } from "../db/schema";
import { addComment, getComments } from "../server/services/commentService";
import { getSeed } from "./seed";

// Reply stil LinkedIn — INTEGRARE (service + DB): un răspuns dat unui reply se lipește tot de RĂDĂCINA
// firului (fir aplatizat), poartă `replyToCommentId` = reply-ul concret, iar `listCommentsForTarget`
// întoarce numele autorului lui pentru eticheta „↳ către <Nume>". Nu se poate da reply peste un
// comentariu de pe altă țintă.
const M_ROOT = "e2e-reply-root-" + Date.now();
const M_R1 = "e2e-reply-lvl1-" + Date.now();
const M_R2 = "e2e-reply-lvl2-" + Date.now();

test("răspuns la un reply → aplatizat sub rădăcină, cu eticheta către autorul reply-ului", async () => {
  const { detailId, testerUserId, authorUserId } = getSeed();
  const created: string[] = [];

  try {
    expect((await addComment({ userId: authorUserId, targetType: "DETAIL", targetId: detailId, body: M_ROOT })).ok).toBe(true);

    let rows = await getComments("DETAIL", detailId);
    const root = rows.find((r) => r.body === M_ROOT)!;
    created.push(root.id);
    expect(root.parentCommentId).toBeNull();

    // Tester răspunde la rădăcină.
    expect(
      (await addComment({ userId: testerUserId, targetType: "DETAIL", targetId: detailId, body: M_R1, parentCommentId: root.id })).ok,
    ).toBe(true);
    rows = await getComments("DETAIL", detailId);
    const r1 = rows.find((r) => r.body === M_R1)!;
    created.push(r1.id);
    expect(r1.parentCommentId).toBe(root.id);
    expect(r1.replyToCommentId).toBeNull(); // răspuns direct la rădăcină → fără etichetă

    // Author răspunde la reply-ul lui tester (nu la rădăcină).
    expect(
      (await addComment({ userId: authorUserId, targetType: "DETAIL", targetId: detailId, body: M_R2, parentCommentId: r1.id })).ok,
    ).toBe(true);
    rows = await getComments("DETAIL", detailId);
    const r2 = rows.find((r) => r.body === M_R2)!;
    created.push(r2.id);
    // Fir APLATIZAT: parent = rădăcina, NU r1.
    expect(r2.parentCommentId).toBe(root.id);
    expect(r2.replyToCommentId).toBe(r1.id);
    // Eticheta „↳ către <Nume>" — numele autorului lui r1 (tester).
    expect(r2.replyToAuthorName).toBeTruthy();
    expect(r2.replyToAuthorName).toBe(r1.authorName);
  } finally {
    if (created.length) await db.delete(comments).where(inArray(comments.id, created));
  }
});

test("reply peste un comentariu de pe altă țintă → INVALID_PARENT", async () => {
  const { detailId, testerUserId } = getSeed();
  const res = await addComment({
    userId: testerUserId,
    targetType: "DETAIL",
    targetId: detailId,
    body: "nu ar trebui salvat",
    parentCommentId: "11111111-1111-4111-8111-111111111111", // uuid valid ca formă, nu e comentariu pe țintă
  });
  expect(res).toEqual({ ok: false, error: "INVALID_PARENT" });
});
