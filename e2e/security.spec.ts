import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { canvases, comments, details, sketches, validations } from "../db/schema";
import { deleteComment, editComment } from "../server/services/commentService";
import { deleteDetailDraft, updateDetail } from "../server/services/detailService";
import { createCanvas, getCanvasForEdit } from "../server/services/plansaService";
import { deleteDraft, deleteSketch } from "../server/services/sketchService";
import { disapprove } from "../server/services/validationService";
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

test.describe("IDOR — ștergere ciornă detaliu (deleteDetailDraft)", () => {
  test("un user nu poate șterge ciorna de detaliu a altui user", async () => {
    const { testerUserId, authorUserId } = getSeed();
    // Ciornă „victimă": DRAFT, autorată de authorUserId. testerUserId încearcă s-o șteargă.
    const [victimDraft] = await db
      .insert(details)
      .values({
        title: "Ciorna privată a victimei",
        description: "seed IDOR draft",
        authorId: authorUserId,
        imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
        status: "DRAFT",
      })
      .returning({ id: details.id });

    try {
      const res = await deleteDetailDraft({ detailId: victimDraft.id, authorId: testerUserId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("NOT_FOUND");

      const [row] = await db.select({ id: details.id }).from(details).where(eq(details.id, victimDraft.id));
      expect(row).toBeTruthy(); // supraviețuiește
    } finally {
      await db.delete(details).where(eq(details.id, victimDraft.id));
    }
  });
});

test.describe("IDOR — ștergere ciornă schiță (deleteDraft)", () => {
  test("un user nu poate șterge ciorna de schiță a altui user", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();
    // Ciornă de schiță „victimă": DRAFT, autorată de authorUserId, peste detaliul seedat.
    const [victimDraft] = await db
      .insert(sketches)
      .values({
        detailId,
        authorId: authorUserId,
        status: "DRAFT",
        strokesJson: [],
      })
      .returning({ id: sketches.id });

    try {
      const deleted = await deleteDraft({ sketchId: victimDraft.id, authorId: testerUserId });
      expect(deleted).toBe(false); // non-owner → nimic șters

      const [row] = await db.select({ id: sketches.id }).from(sketches).where(eq(sketches.id, victimDraft.id));
      expect(row).toBeTruthy(); // supraviețuiește
    } finally {
      await db.delete(sketches).where(eq(sketches.id, victimDraft.id));
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

// Concurență — dublu-submit real (Promise.all), nu doar citit codul. Testul care închide golul semnalat
// în auditul intern: sub cereri paralele, invarianții de business (o poziție/țintă, fără comentarii duplicate)
// trebuie garantați ÎN DB (constrângere unică + upsert atomic cu setWhere), nu prin read-then-write în service.
test.describe("Concurență — dublu-submit dezaprobare (upsert atomic)", () => {
  const JUSTIF = "Dezaprobare concurentă de test (concurrency spec)";

  test("5 dezaprobări paralele pe aceeași țintă → O poziție + UN comentariu-justificare", async () => {
    // testerUserId poate dezaproba detaliul seedat (autorat de author → nu e propriul conținut).
    const { detailId, testerUserId } = getSeed();

    const targetWhere = and(
      eq(validations.userId, testerUserId),
      eq(validations.targetType, "DETAIL"),
      eq(validations.targetId, detailId),
    );
    const commentWhere = and(
      eq(comments.targetType, "DETAIL"),
      eq(comments.targetId, detailId),
      eq(comments.authorId, testerUserId),
      eq(comments.body, JUSTIF),
    );

    // Curăță reziduuri din rulări anterioare (poziția + comentariul de test).
    await db.delete(comments).where(commentWhere);
    await db.delete(validations).where(targetWhere);

    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          disapprove({ userId: testerUserId, targetType: "DETAIL", targetId: detailId, justification: JUSTIF, detailId }),
        ),
      );
      // Fix 2026-07-14: doar UNA din cele 5 cereri paralele câștigă tranziția (ok:true); restul
      // primesc ALREADY_DISAPPROVED (nu mai raportăm „succes" fals când justificarea lor nu s-a
      // salvat — vezi validationService.ts). Invariantul real tot în DB, nu în răspuns.
      const oks = results.filter((r) => r.ok);
      const alreadyDisapproved = results.filter((r) => !r.ok && r.error === "ALREADY_DISAPPROVED");
      expect(oks).toHaveLength(1);
      expect(alreadyDisapproved).toHaveLength(4);

      // Exact O poziție DISAPPROVE (constrângere unică + onConflictDoUpdate).
      const positions = await db
        .select({ position: validations.position })
        .from(validations)
        .where(targetWhere);
      expect(positions).toHaveLength(1);
      expect(positions[0].position).toBe("DISAPPROVE");

      // Exact UN comentariu-justificare — nu 5 duplicate (setWhere blochează tranzițiile ulterioare).
      const justif = await db.select({ id: comments.id }).from(comments).where(commentWhere);
      expect(justif).toHaveLength(1);
    } finally {
      await db.delete(comments).where(commentWhere);
      await db.delete(validations).where(targetWhere);
    }
  });
});
