// Service Comentarii — adăugarea și citirea comentariilor (polimorfic Detail/Sketch; Detail acum).
// Reguli (enforce pe SERVER):
//  - Comentariul cere ROL DECLARAT (apare nume+rol lângă comentariu, ca la validare).
//  - Corpul e obligatoriu (non-vid, ≤ limită). authorId vine din sesiune (apelantul) — fără IDOR.
//  - Ținta trebuie să existe și să fie publică.

import { type TargetType, validateCommentBody } from "@/server/domain/validation";
import { insertComment, listCommentsForTarget } from "@/server/repos/commentsRepo";
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
