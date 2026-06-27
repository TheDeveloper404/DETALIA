"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { TargetType } from "@/server/domain/validation";
import { addComment, deleteComment, editComment } from "@/server/services/commentService";

export type AddCommentState = { error: string | null; ok: boolean };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Conținutul nu mai există.",
  BODY_REQUIRED: "Scrie ceva înainte de a trimite.",
  BODY_TOO_LONG: "Comentariul e prea lung (max 5000 de caractere).",
  NOT_FOUND: "Comentariul nu mai există sau nu îți aparține.",
};

export async function addCommentAction(
  _prev: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tt = String(formData.get("targetType") ?? "DETAIL");
  const targetType: TargetType = tt === "SKETCH" ? "SKETCH" : "DETAIL";
  const targetId = String(formData.get("targetId") ?? "");
  const detailId = String(formData.get("detailId") ?? ""); // pagina de revalidat
  const body = String(formData.get("body") ?? "");

  const res = await addComment({ userId: session.user.id, targetType, targetId, body });

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
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const res = await editComment({ userId: session.user.id, commentId, body });
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
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const res = await deleteComment({ userId: session.user.id, commentId });
  if (!res.ok) {
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }
  revalidatePath(`/details/${detailId}`);
  return { error: null };
}
