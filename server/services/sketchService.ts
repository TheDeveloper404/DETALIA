// Service Schiță — state machine + authz (CRITICAL). Enforce pe SERVER:
//  - Doar AUTORUL schiței editează/trimite; doar AUTORUL detaliului-mamă acceptă/respinge.
//  - DRAFT ─send→ PENDING_ACCEPTANCE ─accept→ PUBLISHED / ─reject→ REJECTED. Tranziții invalide respinse.
//  - Publică DOAR cu send + accept. Un singur autor pe foaie. Stroke-uri normalizate 0..1, validate.
//  - actorUserId vine ÎNTOTDEAUNA din sesiune (apelantul) — fără IDOR.

import { SKETCH_STATUS, type Stroke, validateStrokes } from "@/server/domain/sketch";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  getSketchById,
  insertDraft,
  deleteDraftByAuthor,
  listDraftsByAuthor,
  listPendingByDetail,
  listPublishedByDetail,
  listRecentPublished,
  transitionFromDraft,
  transitionFromPending,
  updateStrokes,
} from "@/server/repos/sketchesRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import {
  notifySketchDecision,
  notifySketchProposed,
} from "@/server/services/notificationService";

export type SketchError =
  | "NO_ROLE"
  | "DETAIL_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "EMPTY_STROKES"
  | "INVALID_STROKES";

export type SketchResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; error: SketchError };

// Creează o foaie nouă (DRAFT) peste un detaliu — se ajunge din fereastra de Dezaprob („fă o schiță").
export async function createDraft(input: {
  detailId: string;
  authorId: string;
}): Promise<SketchResult<{ sketchId: string }>> {
  if (!(await getRoleByUserId(input.authorId))) return { ok: false, error: "NO_ROLE" };
  const detail = await getDetailById(input.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  const sketch = await insertDraft({
    detailId: input.detailId,
    authorId: input.authorId,
    strokesJson: null,
  });
  return { ok: true, value: { sketchId: sketch.id } };
}

// Salvează stroke-urile (autosave) — doar autorul, doar cât e DRAFT.
export async function saveStrokes(input: {
  sketchId: string;
  authorId: string;
  strokes: unknown;
}): Promise<SketchResult> {
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  const validation = validateStrokes(input.strokes);
  if (!validation.ok) {
    return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
  }
  await updateStrokes(input.sketchId, validation.value);
  return { ok: true };
}

// SEND: DRAFT → PENDING_ACCEPTANCE (autor schiță). Notifică autorul detaliului-mamă (in-app + email).
// thumbnailUrl = PNG randat client-side (schița peste imaginea-mamă slabă), pt liste/hover.
export async function send(input: {
  sketchId: string;
  authorId: string;
  strokes?: unknown;
  thumbnailUrl?: string | null;
}): Promise<SketchResult> {
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  // Stroke-urile pot veni odată cu SEND (salvare finală) sau să fie deja persistate.
  let strokes = sketch.strokesJson as Stroke[] | null;
  if (input.strokes !== undefined) {
    const validation = validateStrokes(input.strokes);
    if (!validation.ok) {
      return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
    }
    strokes = validation.value;
    await updateStrokes(input.sketchId, strokes);
  }
  if (!strokes || strokes.length === 0) return { ok: false, error: "EMPTY_STROKES" };

  const detail = await getDetailById(sketch.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  // Tranziție atomică DRAFT → PENDING (guard pe status + autor). Două SEND-uri concurente: doar primul prinde
  // rândul → doar el notifică (notificare idempotentă fără outbox). Al doilea iese cu INVALID_STATE, fără email dublu.
  const transitioned = await transitionFromDraft(input.sketchId, input.authorId, {
    thumbnailUrl: input.thumbnailUrl ?? null,
  });
  if (!transitioned) return { ok: false, error: "INVALID_STATE" };

  const author = await getNotificationActor(sketch.authorId);
  await notifySketchProposed({
    recipientUserId: detail.authorId,
    sketchId: sketch.id,
    detailId: sketch.detailId,
    detailTitle: detail.title,
    sketchAuthorName: author?.name ?? null,
    sketchAuthorRole: author?.roleMain ?? null,
    sketchAuthorVerified: author?.verification === "VERIFIED",
  });
  return { ok: true };
}

// ACCEPT / REJECT: PENDING_ACCEPTANCE → PUBLISHED / REJECTED. Doar autorul detaliului-mamă. Fără justificare.
async function decide(
  input: { sketchId: string; actorUserId: string },
  accepted: boolean,
): Promise<SketchResult> {
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.status !== SKETCH_STATUS.PENDING_ACCEPTANCE) return { ok: false, error: "INVALID_STATE" };

  const detail = await getDetailById(sketch.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };
  if (detail.authorId !== input.actorUserId) return { ok: false, error: "FORBIDDEN" };

  // Tranziție atomică cu guard pe status: dacă un request concurent a decis deja,
  // acesta nu mai prinde rândul în PENDING_ACCEPTANCE → nu scriem rezultat opus, nu notificăm dublu.
  const transitioned = await transitionFromPending(input.sketchId, {
    status: accepted ? SKETCH_STATUS.PUBLISHED : SKETCH_STATUS.REJECTED,
    acceptedAt: accepted ? new Date() : null,
  });
  if (!transitioned) return { ok: false, error: "INVALID_STATE" };

  await notifySketchDecision({
    recipientUserId: sketch.authorId,
    sketchId: sketch.id,
    detailId: sketch.detailId,
    detailTitle: detail.title,
    accepted,
  });
  return { ok: true };
}

export function accept(input: { sketchId: string; actorUserId: string }): Promise<SketchResult> {
  return decide(input, true);
}

export function reject(input: { sketchId: string; actorUserId: string }): Promise<SketchResult> {
  return decide(input, false);
}

// ── Citiri ──────────────────────────────────────────────────────────────────

// Teancul public (schițele PUBLISHED ale unui detaliu).
export function getTeanc(detailId: string) {
  return listPublishedByDetail(detailId);
}

// Schițe noi în teanc, din toată platforma (rail feed) — cele mai recent publicate.
export function getRecentSketches(limit = 4) {
  return listRecentPublished(limit);
}

// Ciornele userului curent (DRAFT) — pentru pagina „Ciornele mele" (reluare oricând).
export function getMyDrafts(userId: string) {
  return listDraftsByAuthor(userId);
}

// Șterge o ciornă a userului curent (doar DRAFT, doar a lui). Întoarce dacă s-a șters ceva.
export function deleteDraft(input: { sketchId: string; authorId: string }): Promise<boolean> {
  return deleteDraftByAuthor(input.sketchId, input.authorId);
}

// Coada de review — DOAR autorul detaliului-mamă vede schițele PENDING.
export async function getPendingForOwner(detailId: string, actorUserId: string) {
  const detail = await getDetailById(detailId);
  if (!detail || detail.authorId !== actorUserId) return [];
  return listPendingByDetail(detailId);
}

// Schița pentru editare — doar autorul, doar DRAFT.
export async function getDraftForEdit(
  sketchId: string,
  authorId: string,
): Promise<SketchResult<{ detailId: string; strokes: Stroke[] }>> {
  const sketch = await getSketchById(sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };
  return {
    ok: true,
    value: { detailId: sketch.detailId, strokes: (sketch.strokesJson as Stroke[] | null) ?? [] },
  };
}

// Schița pentru vizualizare (publicată) — stroke-uri pentru randare peste imaginea-mamă.
export async function getPublishedSketch(sketchId: string) {
  const sketch = await getSketchById(sketchId);
  if (!sketch || sketch.status !== SKETCH_STATUS.PUBLISHED) return null;
  return sketch;
}
