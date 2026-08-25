"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { captureServerEvent, getPostHogClient } from "@/lib/posthog-server";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import type { MaterialOfferFileInput } from "@/server/domain/materialOffer";
import { sendOrUpdateMaterialOffer, withdrawSupplierParticipation } from "@/server/services/materialOfferService";

export type MaterialOfferState = { ok: boolean; error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FURNIZOR: "Doar Furnizorii pot oferta materiale.",
  TARGET_NOT_FOUND: "Detaliul nu mai există.",
  CANNOT_OFFER_OWN: "Nu poți oferta materiale pe propriul detaliu.",
  NOT_PUBLIC: "Ofertele de materiale sunt disponibile doar pe detalii publice.",
  MESSAGE_REQUIRED: "Scrie un mesaj scurt despre ofertă.",
  MESSAGE_TOO_LONG: "Mesajul e prea lung.",
  NO_FILES: "Atașează cel puțin un fișier.",
  TOO_MANY_FILES: "Prea multe fișiere într-o singură ofertă.",
  INVALID_FILE: "Unul dintre fișiere nu e valid — reîncarcă-l.",
  NOT_FOUND: "Nu ai nicio ofertă trimisă pe acest detaliu.",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

// Fișierele sunt deja urcate în Blob CLIENT-SIDE (vezi material-offer-modal.tsx, `uploadDocToBlob`
// kind="materials") ÎNAINTE de acest submit — action-ul primește doar metadatele (url/nume/mărime) ca
// JSON, nu bytes. Validarea REALĂ (tip/mărime/proprietar) s-a făcut deja la emiterea tokenului de
// upload (/api/blob/upload); aici se re-verifică STRUCTURA (URL din propriul store, câmpuri complete)
// — vezi validateMaterialOfferInput, care nu are încredere în ce trimite clientul.
export async function sendMaterialOfferAction(
  prev: MaterialOfferState,
  formData: FormData,
): Promise<MaterialOfferState> {
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const detailId = String(formData.get("detailId") ?? "");
  const message = String(formData.get("message") ?? "");
  let files: MaterialOfferFileInput[] = [];
  try {
    const raw = JSON.parse(String(formData.get("filesJson") ?? "[]"));
    if (Array.isArray(raw)) {
      files = raw
        .filter((f) => f && typeof f === "object")
        .map((f) => ({ url: String(f.url ?? ""), fileName: String(f.fileName ?? ""), fileSize: Number(f.fileSize) }));
    }
  } catch {
    return { ok: false, error: ERROR_MESSAGES.INVALID_FILE };
  }

  const res = await sendOrUpdateMaterialOffer({ userId, detailId, message, files });
  if (!res.ok) {
    if (res.error === "NO_ROLE") redirect("/onboarding");
    return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  captureServerEvent(userId, res.isNew ? "material_offer_sent" : "material_offer_edited", {
    detail_id: detailId,
  });
  await getPostHogClient().flush();

  revalidatePath(`/details/${detailId}`);
  revalidatePath("/profile");
  return { ok: true, error: null };
}

// „Retrage" din modal — un singur buton reface starea inițială: șterge oferta de materiale (dacă
// există) ȘI coboară mâna ridicată. Idempotent — nu poate eșua cu NOT_FOUND (vezi
// withdrawSupplierParticipation), deci UI-ul nu are un caz de eroare de „nimic de retras".
export async function withdrawMaterialOfferAction(
  prev: MaterialOfferState,
  formData: FormData,
): Promise<MaterialOfferState> {
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const detailId = String(formData.get("detailId") ?? "");
  await withdrawSupplierParticipation({ userId, detailId });

  captureServerEvent(userId, "material_offer_withdrawn", { detail_id: detailId });
  await getPostHogClient().flush();

  revalidatePath(`/details/${detailId}`);
  revalidatePath("/profile");
  return { ok: true, error: null };
}
