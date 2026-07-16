// Service Schiță — state machine + authz (CRITICAL). Enforce pe SERVER (simplificat 2026-06-30):
//  - Doar AUTORUL schiței editează/publică; ștergerea o poate face autorul schiței SAU autorul detaliului-mamă.
//  - DRAFT ─publish→ PUBLISHED (direct, fără coadă). Moderare post-publicare prin ștergere.
//  - Un singur autor pe foaie. Stroke-uri normalizate 0..1, validate.
//  - actorUserId vine ÎNTOTDEAUNA din sesiune (apelantul) — fără IDOR.

import { deleteBlobs } from "@/lib/storage";
import { isUuid } from "@/server/domain/ids";
import { SKETCH_STATUS, type Stroke, validateSketchNote, validateStrokes } from "@/server/domain/sketch";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  getSketchById,
  insertDraft,
  deleteDraftByAuthor,
  deleteSketchCascade,
  getPublicSketchTeaser,
  listDraftsByAuthor,
  listPublishedByDetail,
  publishFromDraft,
  updateStrokes,
} from "@/server/repos/sketchesRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifySketchDeleted, notifySketchProposed } from "@/server/services/notificationService";
import { recordSketchDisapproval } from "@/server/services/validationService";

export type SketchError =
  | "NO_ROLE"
  | "DETAIL_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "EMPTY_STROKES"
  | "INVALID_STROKES"
  | "NOTE_TOO_LONG";

export type SketchResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; error: SketchError };

// Creează o foaie nouă (DRAFT) peste un detaliu. Se ajunge din „Schițează peste detaliu" (contribuție
// neutră) SAU din fereastra de Dezaprob → „fă o schiță" (`disapprovesParent: true` → la publicare se
// materializează automat o dezaprobare pe detaliul-mamă, vezi `publish`).
export async function createDraft(input: {
  detailId: string;
  authorId: string;
  disapprovesParent?: boolean;
}): Promise<SketchResult<{ sketchId: string }>> {
  if (!isUuid(input.detailId)) return { ok: false, error: "DETAIL_NOT_FOUND" }; // SEC-11
  if (!(await getRoleByUserId(input.authorId))) return { ok: false, error: "NO_ROLE" };
  const detail = await getDetailById(input.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  const sketch = await insertDraft({
    detailId: input.detailId,
    authorId: input.authorId,
    strokesJson: null,
    disapprovesParent: input.disapprovesParent ?? false,
  });
  return { ok: true, value: { sketchId: sketch.id } };
}

// Salvează stroke-urile (autosave) — doar autorul, doar cât e DRAFT. `note` opțional (undefined = nu se
// atinge) — explicația autorului, SEPARATĂ de desen (2026-07-16).
export async function saveStrokes(input: {
  sketchId: string;
  authorId: string;
  strokes: unknown;
  note?: unknown;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  const validation = validateStrokes(input.strokes);
  if (!validation.ok) {
    return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
  }
  let note: string | null | undefined;
  if (input.note !== undefined) {
    const noteValidation = validateSketchNote(input.note);
    if (!noteValidation.ok) return { ok: false, error: "NOTE_TOO_LONG" };
    note = noteValidation.value;
  }
  await updateStrokes(input.sketchId, validation.value, note);
  return { ok: true };
}

// PUBLISH: DRAFT → PUBLISHED (autor schiță). Intră DIRECT în teanc (fără coadă de acceptare). Notifică
// autorul detaliului-mamă (in-app + email). thumbnailUrl = PNG randat client-side (schița peste imaginea-mamă
// slabă), pt liste/hover. Dacă schița a pornit din „Dezaprob → fă schiță" (`disapprovesParent`), la publicare
// se materializează automat o dezaprobare pe detaliul-mamă (poziție + comentariu-justificare).
export async function publish(input: {
  sketchId: string;
  authorId: string;
  strokes?: unknown;
  note?: unknown;
  thumbnailUrl?: string | null;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  let note: string | null | undefined;
  if (input.note !== undefined) {
    const noteValidation = validateSketchNote(input.note);
    if (!noteValidation.ok) return { ok: false, error: "NOTE_TOO_LONG" };
    note = noteValidation.value;
  }

  // Stroke-urile pot veni odată cu PUBLISH (salvare finală) sau să fie deja persistate.
  let strokes = sketch.strokesJson as Stroke[] | null;
  if (input.strokes !== undefined) {
    const validation = validateStrokes(input.strokes);
    if (!validation.ok) {
      return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
    }
    strokes = validation.value;
    await updateStrokes(input.sketchId, strokes, note);
  } else if (note !== undefined && strokes) {
    await updateStrokes(input.sketchId, strokes, note);
  }
  if (!strokes || strokes.length === 0) return { ok: false, error: "EMPTY_STROKES" };

  const detail = await getDetailById(sketch.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  // Tranziție atomică DRAFT → PUBLISHED (guard pe status + autor). Două PUBLISH concurente: doar primul prinde
  // rândul → doar el notifică / materializează. Al doilea iese cu INVALID_STATE, fără efecte duble.
  const transitioned = await publishFromDraft(input.sketchId, input.authorId, {
    thumbnailUrl: input.thumbnailUrl ?? null,
    publishedAt: new Date(),
  });
  if (!transitioned) return { ok: false, error: "INVALID_STATE" };

  // Dezaprobare-prin-schiță: acum (la publicare) materializăm poziția + justificarea pe detaliul-mamă.
  // Dacă userul abandonase editorul, nu se ajungea aici → nicio dezaprobare „mută".
  if (sketch.disapprovesParent) {
    await recordSketchDisapproval({ userId: sketch.authorId, detailId: sketch.detailId });
  }

  const author = await getNotificationActor(sketch.authorId);
  await notifySketchProposed({
    recipientUserId: detail.authorId,
    sketchId: sketch.id,
    detailId: sketch.detailId,
    detailTitle: detail.title,
    sketchAuthorName: author?.name ?? null,
    sketchAuthorRole: author?.roleMain ?? null,
    sketchAuthorSubRole: author?.subRole ?? null,
    sketchAuthorVerified: author?.verification === "VERIFIED",
  });
  return { ok: true };
}

// ȘTERGE o schiță (moderare post-publicare). Permis dacă actorul e AUTORUL schiței (orice status al ei)
// SAU AUTORUL detaliului-mamă (moderare pe detaliul lui). Cascadă: validări + comentarii pe schiță + blob.
// Notifică autorul schiței doar dacă a șters-o altcineva (autorul-mamă).
export async function deleteSketch(input: {
  sketchId: string;
  actorUserId: string;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };

  const detail = await getDetailById(sketch.detailId);
  const isSketchAuthor = sketch.authorId === input.actorUserId;
  const isDetailAuthor = detail?.authorId === input.actorUserId;
  if (!isSketchAuthor && !isDetailAuthor) return { ok: false, error: "FORBIDDEN" };

  const thumbnailUrl = await deleteSketchCascade(input.sketchId);
  await deleteBlobs([thumbnailUrl]);

  // Autorul-mamă a șters schița altui user → îl anunțăm. Dacă autorul și-a șters propria schiță, fără notificare.
  if (isDetailAuthor && !isSketchAuthor && detail) {
    await notifySketchDeleted({
      recipientUserId: sketch.authorId,
      detailId: sketch.detailId,
      detailTitle: detail.title,
    });
  }
  return { ok: true };
}

// ── Citiri ──────────────────────────────────────────────────────────────────

// Teancul public (schițele PUBLISHED ale unui detaliu).
export function getTeanc(detailId: string) {
  if (!isUuid(detailId)) return Promise.resolve([]); // SEC-11
  return listPublishedByDetail(detailId);
}

// Teaser PUBLIC (fără sesiune) — DOAR schițe PUBLISHED (repo-ul filtrează; o schiță ștearsă/DRAFT
// întoarce null, uniform, fără să distingem cauza — anti-enumerare, la fel ca restul platformei).
export function getPublicSketch(sketchId: string) {
  if (!isUuid(sketchId)) return Promise.resolve(null);
  return getPublicSketchTeaser(sketchId);
}

// Ciornele userului curent (DRAFT) — pentru pagina „Ciornele mele" (reluare oricând).
export function getMyDrafts(userId: string) {
  return listDraftsByAuthor(userId);
}

// Șterge o ciornă a userului curent (doar DRAFT, doar a lui). Întoarce dacă s-a șters ceva.
export function deleteDraft(input: { sketchId: string; authorId: string }): Promise<boolean> {
  if (!isUuid(input.sketchId)) return Promise.resolve(false); // SEC-11
  return deleteDraftByAuthor(input.sketchId, input.authorId);
}

// Schița pentru editare — doar autorul, doar DRAFT.
export async function getDraftForEdit(
  sketchId: string,
  authorId: string,
): Promise<SketchResult<{ detailId: string; strokes: Stroke[]; note: string | null }>> {
  if (!isUuid(sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };
  return {
    ok: true,
    value: {
      detailId: sketch.detailId,
      strokes: (sketch.strokesJson as Stroke[] | null) ?? [],
      note: sketch.note,
    },
  };
}
