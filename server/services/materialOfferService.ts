// Service „Oferă materiale" (Furnizor → autor detaliu): mesaj + fișiere (PDF/Excel/CSV), STRICT pe
// detalii PUBLICE (2026-08-25, decizie de produs — pe proiecte private nu are sens comercial).
// O ofertă per (furnizor, detaliu) — se editează, nu se duplică. Vizibilă DOAR autorului detaliului.

import { isPubliclyVisible } from "@/server/domain/detail";
import { isUuid } from "@/server/domain/ids";
import {
  type MaterialOfferFileInput,
  validateMaterialOfferInput,
} from "@/server/domain/materialOffer";
import { getDetailById } from "@/server/repos/detailsRepo";
import {
  deleteMaterialOffer,
  getMaterialOfferId,
  getMaterialOfferWithFiles,
  listMaterialOffersForDetail,
  replaceMaterialOfferFiles,
  upsertMaterialOffer,
} from "@/server/repos/materialOffersRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { deleteSupplierOffer } from "@/server/repos/supplierOffersRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { isUsersBlobUrl } from "@/lib/blob-url";
import { deleteBlobs } from "@/lib/storage";
import { notifyMaterialOfferEdited, notifyMaterialOfferSent } from "@/server/services/notificationService";

type MaterialOfferError =
  | "NO_ROLE"
  | "NOT_FURNIZOR"
  | "TARGET_NOT_FOUND"
  | "CANNOT_OFFER_OWN"
  | "NOT_PUBLIC"
  | "MESSAGE_REQUIRED"
  | "MESSAGE_TOO_LONG"
  | "NO_FILES"
  | "TOO_MANY_FILES"
  | "INVALID_FILE";

export type SendMaterialOfferResult = { ok: true; isNew: boolean } | { ok: false; error: MaterialOfferError };

// Cine poate ofertă pe acest detaliu — ACELAȘI gard ca `supplierOfferService.toggleSupplierOffer`
// (FURNIZOR verificat din DB, detaliul există și e PUBLISHED, nu e propriul detaliu) + gard NOU:
// detaliul trebuie să fie PUBLIC (nu de proiect) — decizie de produs 2026-08-25.
async function assertCanOffer(input: {
  userId: string;
  detailId: string;
}): Promise<{ ok: true; detail: NonNullable<Awaited<ReturnType<typeof getDetailById>>> } | { ok: false; error: MaterialOfferError }> {
  if (!isUuid(input.detailId)) return { ok: false, error: "TARGET_NOT_FOUND" };

  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };
  if (role.roleMain !== "FURNIZOR") return { ok: false, error: "NOT_FURNIZOR" };

  const detail = await getDetailById(input.detailId); // doar PUBLISHED
  if (!detail) return { ok: false, error: "TARGET_NOT_FOUND" };
  // Anti-enumerare: un detaliu de proiect nu trebuie tratat diferit de unul inexistent pentru cineva
  // care oricum nu are voie să vadă/ofertă pe el (același răspuns ca supplierOfferService).
  if (!isPubliclyVisible(detail)) return { ok: false, error: "NOT_PUBLIC" };
  // `ownerId` (proprietarul real), NU `authorId` (mascat de anonimizare) — la fel ca la hand-raise.
  if (detail.ownerId === input.userId) return { ok: false, error: "CANNOT_OFFER_OWN" };

  return { ok: true, detail };
}

// Trimite SAU editează oferta (idempotent pe insert — unique index face imposibilă duplicarea).
// `files` = lista COMPLETĂ dorită de client (păstrate + noi) — vezi replaceMaterialOfferFiles.
export async function sendOrUpdateMaterialOffer(input: {
  userId: string;
  detailId: string;
  message: string;
  files: MaterialOfferFileInput[];
}): Promise<SendMaterialOfferResult> {
  const guard = await assertCanOffer(input);
  if (!guard.ok) return guard;
  const { detail } = guard;

  const validated = validateMaterialOfferInput({ message: input.message, files: input.files });
  if (!validated.ok) return { ok: false, error: validated.error };

  // SEC-N02 (recidivă SEC-N01, 2026-09-01): validarea de domeniu verifică DOAR forma URL-ului, nu CINE
  // l-a urcat. Fără gardul de proprietate, un furnizor putea atașa URL-ul Blob al altui user pe ofertă,
  // apoi să-l șteargă din storage prin editare (orphanedUrls) sau retragere — `deleteBlobs` filtrează pe
  // store, nu pe owner. Același pattern ca `detailService.hasForeignBlobResource` / `onboardingService`.
  if (validated.files.some((f) => !isUsersBlobUrl(f.url, input.userId))) {
    return { ok: false, error: "INVALID_FILE" };
  }

  const existingOfferId = await getMaterialOfferId(input.detailId, input.userId);
  const isNew = existingOfferId === null;

  const offerId = await upsertMaterialOffer({
    detailId: input.detailId,
    supplierId: input.userId,
    message: validated.message,
  });
  const orphanedUrls = await replaceMaterialOfferFiles(offerId, validated.files);
  await deleteBlobs(orphanedUrls);

  // Notificarea e auxiliară — un eșec aici nu trebuie să facă oferta (deja salvată) să pară eșuată.
  try {
    const actor = await getNotificationActor(input.userId);
    const notifyFn = isNew ? notifyMaterialOfferSent : notifyMaterialOfferEdited;
    await notifyFn({
      recipientUserId: detail.ownerId,
      detailId: input.detailId,
      detailTitle: detail.title,
      supplierName: actor?.name ?? null,
    });
  } catch (err) {
    console.error("[materialOfferService] notificare eșuată (non-fatal)", {
      userId: input.userId,
      detailId: input.detailId,
      err,
    });
  }

  return { ok: true, isNew };
}

// „Retrage" din modal (decizie de produs 2026-08-25): un SINGUR buton reface starea INIȚIALĂ — șterge
// oferta de materiale DACĂ există (poate fi doar mâna ridicată, fără ofertă trimisă încă — modalul se
// deschide la ridicare, înainte de orice trimitere) ȘI coboară mâna ridicată (`supplier_offers`).
// Idempotent pe ambele — nu aruncă dacă oferta/flag-ul nu mai există (dublu-click, tab dublu).
export async function withdrawSupplierParticipation(input: {
  userId: string;
  detailId: string;
}): Promise<{ ok: true }> {
  if (isUuid(input.detailId)) {
    const offerId = await getMaterialOfferId(input.detailId, input.userId);
    if (offerId) {
      const urls = await deleteMaterialOffer(offerId);
      await deleteBlobs(urls);
    }
    await deleteSupplierOffer(input.userId, input.detailId);
  }
  return { ok: true };
}

// Oferta proprie a furnizorului curent pe un detaliu — pt pre-completarea modalului (editare).
export async function getMyMaterialOffer(userId: string, detailId: string) {
  if (!isUuid(detailId)) return null;
  return getMaterialOfferWithFiles(detailId, userId);
}

// STRICT pentru autorul detaliului — orice altcineva primește listă goală (nu eroare: nu vrem să
// dezvăluim dacă există sau nu oferte printr-un cod de eroare diferit; secțiunea pur și simplu nu
// se randează pentru non-autori, la fel ca restul UI-ului condiționat pe `isDetailAuthor`).
export async function getMaterialOffersForOwner(userId: string, detailId: string) {
  if (!isUuid(detailId)) return [];
  const detail = await getDetailById(detailId);
  if (!detail || detail.ownerId !== userId) return [];
  return listMaterialOffersForDetail(detailId);
}
