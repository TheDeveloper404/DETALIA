// Service Comentarii — adăugarea și citirea comentariilor (polimorfic Detail/Sketch; Detail acum).
// Reguli (enforce pe SERVER):
//  - Comentariul cere ROL DECLARAT (apare nume+rol lângă comentariu, ca la validare).
//  - Corpul e obligatoriu (non-vid, ≤ limită). authorId vine din sesiune (apelantul) — fără IDOR.
//  - Ținta trebuie să existe și să fie publică.

import { reprocessBlobImage } from "@/lib/image-processing";
import { extractMentionSketchIds, sanitizeMentions } from "@/lib/mentions";
import { deleteBlobs } from "@/lib/storage";
import { isUuid } from "@/server/domain/ids";
import { type TargetType, validateCommentBody } from "@/server/domain/validation";
import {
  deleteFreeCommentByAuthor,
  getCommentTarget,
  getRootCommentForTarget,
  insertComment,
  listCommentsForTarget,
  toggleCommentLike as toggleCommentLikeRepo,
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

type AddCommentError =
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
  imageUrl?: string | null;
  parentCommentId?: string | null;
}): Promise<AddCommentResult> {
  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };

  const v = validateCommentBody(input.body);
  if (!v.ok) {
    return { ok: false, error: v.error === "REQUIRED" ? "BODY_REQUIRED" : "BODY_TOO_LONG" };
  }

  if (!(await targetExists(input.targetType, input.targetId, input.userId))) {
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

  // Imaginea atașată (opțională, maxim una): trece prin ACELAȘI pipeline ca imaginile de detalii —
  // `reprocessBlobImage` verifică întâi că URL-ul e din store-ul NOSTRU și al userului curent
  // (`u/<userId>/...`, anti-IDOR/anti-SSRF), apoi re-encodează imaginea (curăță metadate/payload
  // ascuns) și șterge originalul. Un URL străin sau o imagine invalidă → comentariul se salvează
  // fără poză, nu eșuează tot (textul e conținutul principal).
  let imageUrl: string | null = null;
  if (input.imageUrl) {
    const processed = await reprocessBlobImage(input.imageUrl, "comments", input.userId);
    imageUrl = processed.ok ? processed.url : null;
  }

  await insertComment({
    targetType: input.targetType,
    targetId: input.targetId,
    authorId: input.userId,
    body,
    imageUrl,
    originValidationId: null, // comentariu liber (nu provine dintr-o dezaprobare)
    parentCommentId,
  });
  return { ok: true };
}

export async function getComments(targetType: TargetType, targetId: string, currentUserId?: string) {
  if (!isUuid(targetId)) return []; // SEC-11: id malformat → fără comentarii (nu eroare SQL)
  return listCommentsForTarget(targetType, targetId, currentUserId);
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
  // SEC-009 (audit securitate 2026-08-11): editarea propriului comentariu pe un detaliu de proiect din
  // care userul a fost între timp eliminat NU mai e permisă — aceeași poartă ca la addComment/
  // toggleCommentLike (targetExists), altfel citirea era închisă dar scrierea rămânea deschisă.
  if (target && !(await targetExists(target.targetType, target.targetId, input.userId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
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
  // SEC-009 (audit securitate 2026-08-11): ștergerea propriului comentariu pe un detaliu de proiect din
  // care userul a fost între timp eliminat NU mai e permisă — vezi nota identică din editComment.
  const target = await getCommentTarget(input.commentId);
  if (target && !(await targetExists(target.targetType, target.targetId, input.userId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const { deleted, imageUrl } = await deleteFreeCommentByAuthor(input.commentId, input.userId);
  if (!deleted) return { ok: false, error: "NOT_FOUND" };
  // Fișierul din Blob moare odată cu comentariul — best-effort (deleteBlobs nu aruncă): rândul e deja
  // șters, un orfan în storage nu justifică să raportăm eșec userului.
  await deleteBlobs([imageUrl]);
  return { ok: true };
}

export type ToggleCommentLikeResult =
  | { ok: true; myVote: "UP" | "DOWN" | null }
  | { ok: false; error: "NO_ROLE" | "NOT_FOUND" | "CANNOT_LIKE_OWN" };

// Toggle vot (up/down) — cere rol declarat (ca la comentat/validat) și blochează votul pe propriul
// comentariu (aceeași regulă ca la validare: nu te poți valida/aprecia singur).
export async function toggleCommentLike(input: {
  userId: string;
  commentId: string;
  direction: "UP" | "DOWN";
}): Promise<ToggleCommentLikeResult> {
  if (!isUuid(input.commentId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11

  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };

  const target = await getCommentTarget(input.commentId);
  if (!target) return { ok: false, error: "NOT_FOUND" };
  // Proiecte (2026-08-09, gol găsit la /code-review): un vot pe un comentariu de pe un detaliu de
  // proiect e tot o interacțiune cu conținut privat — aceeași poartă ca la addComment/targetExists.
  if (!(await targetExists(target.targetType, target.targetId, input.userId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (target.authorId === input.userId) return { ok: false, error: "CANNOT_LIKE_OWN" };

  const myVote = await toggleCommentLikeRepo(input.commentId, input.userId, input.direction);
  return { ok: true, myVote };
}
