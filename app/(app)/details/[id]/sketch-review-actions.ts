"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { createDraft, deleteSketch } from "@/server/services/sketchService";

// Șterge o schiță din teanc (moderare post-publicare) — autorul schiței SAU autorul detaliului-mamă
// (authz în service). actorUserId din sesiune; sketchId din formular. Pe authz greșit → FORBIDDEN, no-op.
export async function deleteSketchAction(formData: FormData): Promise<void> {
  // SEC-04: ștergerea e MODERARE (atinge conținutul altora) — un cont suspendat nu o mai poate face.
  const userId = await requireActiveUserId();

  const sketchId = String(formData.get("sketchId") ?? "");
  const detailId = String(formData.get("detailId") ?? "");

  // SEC-01: ștergerea declanșează scrieri DB (cascadă) + posibil email → limită per user; la depășire, no-op.
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    redirect(`/details/${detailId}`);
  }

  await deleteSketch({ sketchId, actorUserId: userId });
  revalidatePath(`/details/${detailId}`);
}

// Pornește o schiță peste detaliu: creează un DRAFT și duce autorul în editor.
// ORICE user cu rol declarat poate schița (nu doar autorul-mamă). NO_ROLE → onboarding.
export async function startSketchAction(formData: FormData): Promise<void> {
  // SEC-04: crearea de conținut (fie și DRAFT) — re-check status proaspăt din DB.
  const userId = await requireActiveUserId();

  const detailId = String(formData.get("detailId") ?? "");

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    redirect(`/details/${detailId}`);
  }

  const draft = await createDraft({ detailId, authorId: userId });
  if (!draft.ok) {
    if (draft.error === "NO_ROLE") redirect("/onboarding");
    redirect(`/details/${detailId}`);
  } else {
    redirect(`/sketches/${draft.value.sketchId}/edit`);
  }
}
