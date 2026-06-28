"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import type { TargetType } from "@/server/domain/validation";
import { createDraft } from "@/server/services/sketchService";
import { approve, disapprove, retract } from "@/server/services/validationService";

export type DisapproveState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Conținutul nu mai există.",
  JUSTIFICATION_REQUIRED: "Dezaprobarea cere o justificare.",
  JUSTIFICATION_TOO_LONG: "Justificarea e prea lungă (max 5000 de caractere).",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

// targetType/targetId = ținta poziției (DETAIL sau SKETCH); detailId = pagina de revalidat (detaliul-părinte).
function readTarget(formData: FormData): {
  targetType: TargetType;
  targetId: string;
  detailId: string;
} {
  const tt = String(formData.get("targetType") ?? "DETAIL");
  return {
    targetType: tt === "SKETCH" ? "SKETCH" : "DETAIL",
    targetId: String(formData.get("targetId") ?? ""),
    detailId: String(formData.get("detailId") ?? ""),
  };
}

export async function approveAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // SEC-01: limită de mutații per user. Acțiune 1-click → la depășire ieșim tăcut (fără mutație).
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) return;

  const { targetType, targetId, detailId } = readTarget(formData);
  const res = await approve({ userId: session.user.id, targetType, targetId });
  if (!res.ok && res.error === "NO_ROLE") redirect("/onboarding");

  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
}

export async function retractAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) return;

  const { targetType, targetId, detailId } = readTarget(formData);
  await retract({ userId: session.user.id, targetType, targetId });

  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
}

export async function disapproveAction(
  _prev: DisapproveState,
  formData: FormData,
): Promise<DisapproveState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const { targetType, targetId, detailId } = readTarget(formData);
  const justification = String(formData.get("justification") ?? "");

  const res = await disapprove({ userId: session.user.id, targetType, targetId, justification });
  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // Schițarea se ajunge DOAR de aici și DOAR pe un detaliu: „Dezaprob și fac o schiță" → draft + editor.
  if (targetType === "DETAIL" && String(formData.get("intent") ?? "send") === "sketch") {
    const draft = await createDraft({ detailId: targetId, authorId: session.user.id });
    if (draft.ok) redirect(`/sketches/${draft.value.sketchId}/edit`);
  }

  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
  return { error: null };
}
