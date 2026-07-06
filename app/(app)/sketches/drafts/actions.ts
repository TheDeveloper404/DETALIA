"use server";

import { revalidatePath } from "next/cache";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteDetailDraft } from "@/server/services/detailService";
import { deleteDraft } from "@/server/services/sketchService";

// Șterge o ciornă de SCHIȚĂ a userului curent. Ownership + starea DRAFT sunt verificate în service/repo.
export async function deleteDraftAction(formData: FormData) {
  // SEC-04: mutație (rară) → status proaspăt din DB, consecvent cu restul acțiunilor.
  const userId = await requireActiveUserId();

  // SEC-A5: aceeași cotă ca restul mutațiilor (uniformizare).
  if (!(await checkLimit(limiters.mutation, userId)).ok) return;

  const sketchId = String(formData.get("sketchId") ?? "");
  if (sketchId) {
    await deleteDraft({ sketchId, authorId: userId });
  }
  revalidatePath("/sketches/drafts");
}

// Șterge o ciornă de DETALIU a userului curent. Ownership + starea DRAFT verificate în service (getDetailForEdit).
export async function deleteDetailDraftAction(formData: FormData) {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) return;

  const detailId = String(formData.get("detailId") ?? "");
  if (detailId) {
    await deleteDetailDraft({ detailId, authorId: userId });
  }
  revalidatePath("/sketches/drafts");
}
