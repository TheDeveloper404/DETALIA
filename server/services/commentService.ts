// Service Comentarii — adăugarea și citirea comentariilor (polimorfic Detail/Sketch; Detail acum).
// Reguli (enforce pe SERVER):
//  - Comentariul cere ROL DECLARAT (apare nume+rol lângă comentariu, ca la validare).
//  - Corpul e obligatoriu (non-vid, ≤ limită). authorId vine din sesiune (apelantul) — fără IDOR.
//  - Ținta trebuie să existe și să fie publică.

import { type TargetType, validateCommentBody } from "@/server/domain/validation";
import {
  deleteFreeCommentByAuthor,
  insertComment,
  listCommentsForTarget,
  updateCommentByAuthor,
} from "@/server/repos/commentsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { targetExists } from "@/server/services/validationService";

export type AddCommentError =
  | "NO_ROLE"
  | "TARGET_NOT_FOUND"
  | "BODY_REQUIRED"
  | "BODY_TOO_LONG";

export type AddCommentResult = { ok: true } | { ok: false; error: AddCommentError };

export async function addComment(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  body: string;
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

  await insertComment({
    targetType: input.targetType,
    targetId: input.targetId,
    authorId: input.userId,
    body: v.value,
    originValidationId: null, // comentariu liber (nu provine dintr-o dezaprobare)
  });
  return { ok: true };
}

export async function getComments(targetType: TargetType, targetId: string) {
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
  const v = validateCommentBody(input.body);
  if (!v.ok) {
    return { ok: false, error: v.error === "REQUIRED" ? "BODY_REQUIRED" : "BODY_TOO_LONG" };
  }
  const updated = await updateCommentByAuthor(input.commentId, input.userId, v.value);
  return updated ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

export type DeleteCommentResult = { ok: true } | { ok: false; error: "NOT_FOUND" };

// Șterge un comentariu propriu (doar comentariu liber — vezi repo). NOT_FOUND acoperă și „nu e al tău".
export async function deleteComment(input: {
  userId: string;
  commentId: string;
}): Promise<DeleteCommentResult> {
  const deleted = await deleteFreeCommentByAuthor(input.commentId, input.userId);
  return deleted ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}
