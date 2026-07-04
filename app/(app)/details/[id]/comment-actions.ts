"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import type { TargetType } from "@/server/domain/validation";
import { addComment, deleteComment, editComment } from "@/server/services/commentService";

export type AddCommentState = { error: string | null; ok: boolean };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Conținutul nu mai există.",
  BODY_REQUIRED: "Scrie ceva înainte de a trimite.",
  BODY_TOO_LONG: "Comentariul e prea lung (max 5000 de caractere).",
  NOT_FOUND: "Comentariul nu mai există sau nu îți aparține.",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

export async function addCommentAction(
  _prev: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate comenta.
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED, ok: false };
  }

  const tt = String(formData.get("targetType") ?? "DETAIL");
  const targetType: TargetType = tt === "SKETCH" ? "SKETCH" : "DETAIL";
  const targetId = String(formData.get("targetId") ?? "");
  const detailId = String(formData.get("detailId") ?? ""); // pagina de revalidat
  const body = String(formData.get("body") ?? "");

  const res = await addComment({ userId, targetType, targetId, body });

  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou.", ok: false };
  }

  revalidatePath(`/details/${detailId}`);
  return { error: null, ok: true };
}

// Editare comentariu propriu — apelată direct din client (în transition). detailId = pagina de revalidat.
export async function editCommentAction(
  commentId: string,
  detailId: string,
  body: string,
): Promise<{ error: string | null }> {
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate edita conținut.
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const res = await editComment({ userId, commentId, body });
  if (!res.ok) {
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }
  revalidatePath(`/details/${detailId}`);
  return { error: null };
}

// Ștergere comentariu propriu (doar comentariu liber) — apelată direct din client (în transition).
export async function deleteCommentAction(
  commentId: string,
  detailId: string,
): Promise<{ error: string | null }> {
  // SEC-04: ștergerea de comentariu e mutație pe conținut de dezbatere — consecvent cu add/edit, un cont
  // suspendat cu JWT viu nu o mai poate face.
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const res = await deleteComment({ userId, commentId });
  if (!res.ok) {
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }
  revalidatePath(`/details/${detailId}`);
  return { error: null };
}
