"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { joinProjectByToken } from "@/server/services/projectService";

export type JoinActionResult = { ok: boolean; error?: string };

// Confirmare „Te alături proiectului X?" — userul e deja logat (pagina arată acest buton doar
// atunci). SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu se poate
// alătura unui proiect.
export async function joinProjectAction(
  _prevState: JoinActionResult,
  formData: FormData,
): Promise<JoinActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: "Prea multe acțiuni. Așteaptă un moment." };
  }
  const token = String(formData.get("token") ?? "");
  const res = await joinProjectByToken({ token, userId });
  if (!res.ok) return { ok: false, error: "Linkul de invitație nu mai e valid." };
  revalidatePath(`/projects/${res.projectId}`);
  redirect(`/projects/${res.projectId}`);
}
