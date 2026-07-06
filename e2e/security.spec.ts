import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { canvases, comments, details, sketches } from "../db/schema";
import { deleteComment, editComment } from "../server/services/commentService";
import { updateDetail } from "../server/services/detailService";
import { createCanvas, getCanvasForEdit } from "../server/services/plansaService";
import { deleteSketch } from "../server/services/sketchService";
import { getSeed } from "./seed";

// E2E de SECURITATE — IDOR (nu-s teste de UI/browser, ci apeluri directe pe service+DB reale, ca
// integration test). Reproduc automat exact scenariile verificate manual (curl) în auditul CRITICAL
// 2026-07-02 (docs/SECURITATE.md §C.2/C.1/C.3): un „atacator" (userul de sesiune, e2e-tester) încearcă
// să editeze/șteargă conținut al altui user (e2e-author) — trebuie respins, iar victima rămâne intactă.
// NU rulează pe prod — DATABASE_URL din .env.e2e țintește ramura preview/dev.

test.describe("IDOR — comentariu (C.2)", () => {
  test("attacker nu poate edita comentariul victimei", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();
    const [victimComment] = await db
      .insert(comments)
      .values({
        targetType: "DETAIL",
        targetId: detailId,
        authorId: authorUserId,
        body: "Comentariul original al victimei",
      })
      .returning({ id: comments.id, body: comments.body });

    try {
      const res = await editComment({
        userId: testerUserId,
        commentId: victimComment.id,
        body: "hacked by attacker",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("NOT_FOUND");

      const [row] = await db
        .select({ body: comments.body })
        .from(comments)
        .where(eq(comments.id, victimComment.id));
      expect(row.body).toBe("Comentariul original al victimei");
    } finally {
      await db.delete(comments).where(eq(comments.id, victimComment.id));
    }
  });

  test("attacker nu poate șterge comentariul victimei", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();
    const [victimComment] = await db
      .insert(comments)
      .values({
        targetType: "DETAIL",
        targetId: detailId,
        authorId: authorUserId,
        body: "Alt comentariu al victimei",
      })
      .returning({ id: comments.id });

    try {
      const res = await deleteComment({ userId: testerUserId, commentId: victimComment.id });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("NOT_FOUND");

      const [row] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, victimComment.id));
      expect(row).toBeTruthy(); // supraviețuiește
    } finally {
      await db.delete(comments).where(eq(comments.id, victimComment.id));
    }
  });
});

test.describe("IDOR — schiță (C.1/C.3)", () => {
  test("un user care NU e nici autorul schiței, nici autorul detaliului nu o poate șterge", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();
    // Schiță „victimă": autorată de authorUserId (care e ȘI autorul detaliului-mamă în seed) — deci
    // singurul care ar avea drept de ștergere e authorUserId. testerUserId nu e nici sketch-author, nici
    // detail-author → trebuie respins FORBIDDEN.
    const [victimSketch] = await db
      .insert(sketches)
      .values({
        detailId,
        authorId: authorUserId,
        status: "PUBLISHED",
        strokesJson: [],
      })
      .returning({ id: sketches.id });

    try {
      const res = await deleteSketch({ sketchId: victimSketch.id, actorUserId: testerUserId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("FORBIDDEN");

      const [row] = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(eq(sketches.id, victimSketch.id));
      expect(row).toBeTruthy(); // supraviețuiește
    } finally {
      await db.delete(sketches).where(eq(sketches.id, victimSketch.id));
    }
  });
});

test.describe("IDOR — planșă (strict privată)", () => {
  test("un user NU poate deschide planșa altui user", async () => {
    const { testerUserId, authorUserId } = getSeed();

    const created = await createCanvas({ ownerId: authorUserId, name: "Planșa privată a victimei" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    try {
      const res = await getCanvasForEdit({ canvasId: created.value.canvasId, ownerId: testerUserId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("NOT_FOUND");

      // Owner-ul real tot o vede — nu e o gaură generală, doar authz pe non-owner.
      const ownerRes = await getCanvasForEdit({ canvasId: created.value.canvasId, ownerId: authorUserId });
      expect(ownerRes.ok).toBe(true);
    } finally {
      await db.delete(canvases).where(eq(canvases.id, created.value.canvasId));
    }
  });
});

test.describe("IDOR — editare detaliu (updateDetail)", () => {
  test("un user care NU e autorul detaliului nu-l poate edita", async () => {
    // Detaliul seedat (auth.setup.ts) e autorat de authorUserId — testerUserId încearcă să-l editeze.
    const { detailId, testerUserId, categoryId } = getSeed();
    const [before] = await db.select({ title: details.title }).from(details).where(eq(details.id, detailId));

    const res = await updateDetail({
      detailId,
      userId: testerUserId,
      title: "Titlu injectat de atacator",
      categoryIds: [categoryId],
      imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("FORBIDDEN");

    const [after] = await db.select({ title: details.title }).from(details).where(eq(details.id, detailId));
    expect(after.title).toBe(before.title); // neatins
  });
});
