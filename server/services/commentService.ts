// Service Comentarii — adăugarea și citirea comentariilor (polimorfic Detail/Sketch; Detail acum).
// Reguli (enforce pe SERVER):
//  - Comentariul cere ROL DECLARAT (apare nume+rol lângă comentariu, ca la validare).
//  - Corpul e obligatoriu (non-vid, ≤ limită). authorId vine din sesiune (apelantul) — fără IDOR.
//  - Ținta trebuie să existe și să fie publică.

import { extractMentionSketchIds, sanitizeMentions } from "@/lib/mentions";
import { isUuid } from "@/server/domain/ids";
import { type TargetType, validateCommentBody } from "@/server/domain/validation";
import {
  deleteFreeCommentByAuthor,
  getCommentTarget,
  getRootCommentForTarget,
  insertComment,
  listCommentsForTarget,
  updateCommentByAuthor,
} from "@/server/repos/commentsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { filterSketchIdsByDetail } from "@/server/repos/sketchesRepo";
import { targetExists } from "@/server/services/validationService";

// Validează mențiunile @schiță dintr-un corp de comentariu de pe un DETALIU: tokenii care nu trimit
// către o schiță PUBLISHED a acestui detaliu se degradează la text (anti-IDOR / referință arbitrară).
// Corpul rezultat e cel care se stochează. Fără mențiuni → întoarce corpul neatins (zero query).
async function sanitizeDetailMentions(detailId: string, body: string): Promise<string> {
  const referenced = extractMentionSketchIds(body);
  if (referenced.length === 0) return body;
  const valid = await filterSketchIdsByDetail(detailId, referenced);
  return sanitizeMentions(body, valid);
}

export type AddCommentError =
  | "NO_ROLE"
  | "TARGET_NOT_FOUND"
  | "BODY_REQUIRED"
  | "BODY_TOO_LONG"
  | "INVALID_PARENT";

export type AddCommentResult = { ok: true } | { ok: false; error: AddCommentError };

export async function addComment(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<AddCommentResult> {
  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };

  const v = validateCommentBody(input.body);
  if (!v.ok) {
    return { ok: false, error: v.error === "REQUIRED" ? "BODY_REQUIRED" : "BODY_TOO_LONG" };
  }

  if (!(await targetExists(input.targetType, input.targetId))) {
    return { ok: false, error: "TARGET_NOT_FOUND" };
  }

  // Reply — UN SINGUR nivel: părintele trebuie să existe, să fie pe ACEEAȘI țintă, ȘI să fie el însuși
  // rădăcină (nu poți da reply la un reply). isUuid întâi (SEC-11, id malformat → fără query).
  let parentCommentId: string | null = null;
  if (input.parentCommentId) {
    if (!isUuid(input.parentCommentId)) return { ok: false, error: "INVALID_PARENT" };
    const root = await getRootCommentForTarget(input.parentCommentId, input.targetType, input.targetId);
    if (!root) return { ok: false, error: "INVALID_PARENT" };
    parentCommentId = root.id;
  }

  // Mențiuni @schiță doar pe comentariile de DETALIU (targetId = detailId); tokenii străini se degradează.
  const body =
    input.targetType === "DETAIL"
      ? await sanitizeDetailMentions(input.targetId, v.value)
      : v.value;

  await insertComment({
    targetType: input.targetType,
    targetId: input.targetId,
    authorId: input.userId,
    body,
    originValidationId: null, // comentariu liber (nu provine dintr-o dezaprobare)
    parentCommentId,
  });
  return { ok: true };
}

export async function getComments(targetType: TargetType, targetId: string) {
  if (!isUuid(targetId)) return []; // SEC-11: id malformat → fără comentarii (nu eroare SQL)
  return listCommentsForTarget(targetType, targetId);
}

export type EditCommentResult =
  | { ok: true }
  | { ok: false; error: "BODY_REQUIRED" | "BODY_TOO_LONG" | "NOT_FOUND" };

// Editează un comentariu propriu. Ownership = condiția pe authorId din repo (fără IDOR).
export async function editComment(input: {
  userId: string;
  commentId: string;
  body: string;
}): Promise<EditCommentResult> {
  if (!isUuid(input.commentId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const v = validateCommentBody(input.body);
  if (!v.ok) {
    return { ok: false, error: v.error === "REQUIRED" ? "BODY_REQUIRED" : "BODY_TOO_LONG" };
  }

  // Re-validează mențiunile la editare (corpul nou poate introduce sid-uri străine). detailId derivat
  // din ținta comentariului (comentariile de dezbatere sunt pe DETAIL → targetId = detailId).
  const target = await getCommentTarget(input.commentId);
  const body =
    target?.targetType === "DETAIL"
      ? await sanitizeDetailMentions(target.targetId, v.value)
      : v.value;

  const updated = await updateCommentByAuthor(input.commentId, input.userId, body);
  return updated ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

export type DeleteCommentResult = { ok: true } | { ok: false; error: "NOT_FOUND" };

// Șterge un comentariu propriu (doar comentariu liber — vezi repo). NOT_FOUND acoperă și „nu e al tău".
export async function deleteComment(input: {
  userId: string;
  commentId: string;
}): Promise<DeleteCommentResult> {
  if (!isUuid(input.commentId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const deleted = await deleteFreeCommentByAuthor(input.commentId, input.userId);
  return deleted ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}
