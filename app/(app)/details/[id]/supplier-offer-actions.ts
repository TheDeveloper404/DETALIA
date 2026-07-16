"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { requireActiveUserId } from "@/lib/require-active-user";
import { toggleSupplierOffer } from "@/server/services/supplierOfferService";

export type SupplierOfferState = { error: string | null; offering: boolean };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FURNIZOR: "Doar Furnizorii pot semnala că pot oferta materiale.",
  TARGET_NOT_FOUND: "Detaliul nu mai există.",
  CANNOT_OFFER_OWN: "Nu poți oferta materiale pe propriul detaliu.",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

// Comută „ridic mâna" (poate oferta materiale) — mutație VIZIBILĂ public (lista de pe pagina detaliului),
// deci SEC-04: status proaspăt din DB (nu doar sesiune JWT stale), ca la validare.
export async function toggleSupplierOfferAction(
  prev: SupplierOfferState,
  formData: FormData,
): Promise<SupplierOfferState> {
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED, offering: prev.offering };
  }

  const detailId = String(formData.get("detailId") ?? "");
  const res = await toggleSupplierOffer({ userId, detailId });
  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou.", offering: prev.offering };
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: res.offering ? "supplier_offer_raised" : "supplier_offer_withdrawn",
    properties: { detail_id: detailId },
  });
  await posthog.flush();

  revalidatePath(`/details/${detailId}`);
  return { error: null, offering: res.offering };
}
