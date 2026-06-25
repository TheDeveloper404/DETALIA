"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { TargetType } from "@/server/domain/validation";
import { addComment } from "@/server/services/commentService";

export type AddCommentState = { error: string | null; ok: boolean };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Conținutul nu mai există.",
  BODY_REQUIRED: "Scrie ceva înainte de a trimite.",
  BODY_TOO_LONG: "Comentariul e prea lung (max 5000 de caractere).",
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
