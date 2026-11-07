"use server";

import { revalidatePath } from "next/cache";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteDetailDraft } from "@/server/services/detailService";
import { deleteDraft } from "@/server/services/sketchService";

export type DraftActionResult = { ok: boolean; error?: string };

// Peste limita stergerea nu se face; mesajul ii spune userului de ce cardul revine in lista.
const RATE_LIMITED = "Prea multe ștergeri într-un minut. Așteaptă puțin și încearcă din nou.";

// Șterge o ciornă de SCHIȚĂ a userului curent. Ownership + starea DRAFT sunt verificate în service/repo.
export async function deleteDraftAction(formData: FormData): Promise<DraftActionResult> {
  // SEC-04: mutație (rară) → status proaspăt din DB, consecvent cu restul acțiunilor.
  const userId = await requireActiveUserId();

  // SEC-A5: aceeași cotă ca restul mutațiilor (uniformizare).
  if (!(await checkLimit(limiters.mutation, userId)).ok) return { ok: false, error: RATE_LIMITED };

  const sketchId = String(formData.get("sketchId") ?? "");
  if (sketchId) {
    await deleteDraft({ sketchId, authorId: userId });
  }
  revalidatePath("/sketches/drafts");
  return { ok: true };
}

// Șterge o ciornă de DETALIU a userului curent. Ownership + starea DRAFT verificate în service (getDetailForEdit).
export async function deleteDetailDraftAction(formData: FormData): Promise<DraftActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) return { ok: false, error: RATE_LIMITED };

  const detailId = String(formData.get("detailId") ?? "");
  if (detailId) {
    await deleteDetailDraft({ detailId, authorId: userId });
  }
  revalidatePath("/sketches/drafts");
  return { ok: true };
}
