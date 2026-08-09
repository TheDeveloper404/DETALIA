"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import {
  createProject,
  deleteProject,
  regenerateInviteLink,
  removeMember,
} from "@/server/services/projectService";
import { releaseDetailToCommunity } from "@/server/services/detailService";

export type ProjectActionResult = { ok: boolean; error?: string; inviteToken?: string };

const ERROR_MESSAGES: Record<string, string> = {
  EMPTY: "Dă un nume proiectului.",
  TOO_LONG: "Numele e prea lung (max 80 de caractere).",
  NOT_FOUND: "Proiectul nu mai există.",
  FORBIDDEN: "Nu ai voie să faci asta.",
  NOT_IN_PROJECT: "Detaliul nu mai e într-un proiect.",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

// Creează un proiect nou. `redirect` direct la pagina lui — owner-ul are acces imediat.
export async function createProjectAction(
  _prevState: ProjectActionResult,
  formData: FormData,
): Promise<ProjectActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const name = String(formData.get("name") ?? "");
  const res = await createProject({ ownerId: userId, name });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut crea proiectul." };
  revalidatePath("/projects");
  redirect(`/projects/${res.projectId}`);
}

// Regenerare link de invitație — doar owner. Apelată direct din client (nu form), întoarce tokenul nou.
export async function regenerateInviteLinkAction(projectId: string): Promise<ProjectActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await regenerateInviteLink({ projectId, requesterId: userId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut regenera linkul." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, inviteToken: res.inviteToken };
}

// Eliminare membru — doar owner. Form action (useActionState) → revalidate.
export async function removeMemberAction(
  _prevState: ProjectActionResult,
  formData: FormData,
): Promise<ProjectActionResult> {
  const userId = await requireActiveUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await removeMember({ projectId, requesterId: userId, targetUserId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut elimina membrul." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// Ștergere proiect — doar owner. Ireversibil (cascadă pe detaliile ÎNCĂ în proiect). Redirect la listă.
export async function deleteProjectAction(
  _prevState: ProjectActionResult,
  formData: FormData,
): Promise<ProjectActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const projectId = String(formData.get("projectId") ?? "");
  const res = await deleteProject({ projectId, requesterId: userId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut șterge proiectul." };
  revalidatePath("/projects");
  redirect("/projects");
}

// „Scoate în comunitate" — de pe pagina detaliului. Ireversibil (regula „orfan", vezi projectService).
export async function releaseToCommunityAction(
  _prevState: ProjectActionResult,
  formData: FormData,
): Promise<ProjectActionResult> {
  const userId = await requireActiveUserId();
  const detailId = String(formData.get("detailId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await releaseDetailToCommunity({ detailId, userId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut scoate detaliul." };
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
  revalidatePath(`/projects/${res.projectId}`);
  return { ok: true };
}
