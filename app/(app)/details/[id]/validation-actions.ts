"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { requireActiveUserId } from "@/lib/require-active-user";
import type { TargetType } from "@/server/domain/validation";
import { createDraft } from "@/server/services/sketchService";
import { approve, disapprove, retract } from "@/server/services/validationService";

export type DisapproveState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  TARGET_NOT_FOUND: "Conținutul nu mai există.",
  DETAIL_NOT_FOUND: "Detaliul nu mai există.",
  CANNOT_VALIDATE_OWN: "Nu îți poți valida propriul conținut.",
  JUSTIFICATION_REQUIRED: "Dezaprobarea cere o justificare.",
  JUSTIFICATION_TOO_LONG: "Justificarea e prea lungă (max 5000 de caractere).",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
  ALREADY_DISAPPROVED:
    "Ai dezaprobat deja acest conținut — textul nou nu a fost salvat. Editează justificarea existentă din comentarii dacă vrei s-o schimbi.",
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
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate produce poziții.
  const userId = await requireActiveUserId();

  // SEC-01: limită de mutații per user. Acțiune 1-click → la depășire ieșim tăcut (fără mutație).
  if (!(await checkLimit(limiters.mutation, userId)).ok) return;

  const { targetType, targetId, detailId } = readTarget(formData);
  const res = await approve({ userId, targetType, targetId });
  if (!res.ok && res.error === "NO_ROLE") redirect("/onboarding");

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "detail_approved",
    properties: { target_type: targetType, target_id: targetId, detail_id: detailId },
  });
  await posthog.flush();

  revalidatePath(`/details/${detailId}`);
}

export async function retractAction(formData: FormData): Promise<void> {
  // SEC-04: și retragerea e o mutație — fără excepții de la „suspendat = zero mutații + delogare".
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) return;

  const { targetType, targetId, detailId } = readTarget(formData);
  await retract({ userId, targetType, targetId });

  revalidatePath(`/details/${detailId}`);
}

export async function disapproveAction(
  _prev: DisapproveState,
  formData: FormData,
): Promise<DisapproveState> {
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate dezaproba.
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const { targetType, targetId, detailId } = readTarget(formData);
  const intent = String(formData.get("intent") ?? "send");

  // Ramura SCHIȚĂ (doar pe DETAIL): „Dezaprob → fac o schiță". NU înregistrăm încă dezaprobarea — schița E
  // justificarea. Poziția DISAPPROVE + comentariul se materializează la PUBLICAREA schiței (sketchService.publish),
  // ca să nu rămână o „dezaprobare mută" dacă autorul abandonează editorul. Marcăm draftul cu disapprovesParent.
  if (targetType === "DETAIL" && intent === "sketch") {
    const draft = await createDraft({
      detailId: targetId,
      authorId: userId,
      disapprovesParent: true,
    });
    if (!draft.ok) {
      if (draft.error === "NO_ROLE") redirect("/onboarding");
      return { error: ERROR_MESSAGES[draft.error] ?? "Ceva n-a mers. Încearcă din nou." };
    }
    redirect(`/sketches/${draft.value.sketchId}/edit`);
  }

  // Ramura TEXT: justificare obligatorie → DISAPPROVE + comentariu (originValidationId).
  const justification = String(formData.get("justification") ?? "");
  const res = await disapprove({ userId, targetType, targetId, justification, detailId });
  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "detail_disapproved",
    properties: { target_type: targetType, target_id: targetId, detail_id: detailId },
  });
  await posthog.flush();

  revalidatePath(`/details/${detailId}`);
  return { error: null };
}
