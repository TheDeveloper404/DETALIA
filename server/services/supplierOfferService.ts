// Service „ridic mâna" Furnizor — INIMA regulii: doar FURNIZOR (verificat din DB, nu din client) poate
// semnala că poate oferta materiale pe un detaliu. Reversibil (al doilea click retrage). Notificare
// in-app către autor DOAR la primul click (nu la fiecare retragere/reofertare).

import { isUuid } from "@/server/domain/ids";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  deleteSupplierOffer,
  insertSupplierOffer,
  isSupplierOfferedByUser,
  listSupplierOffersForDetail,
} from "@/server/repos/supplierOffersRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifySupplierOffered } from "@/server/services/notificationService";

export type SupplierOfferError = "NO_ROLE" | "NOT_FURNIZOR" | "TARGET_NOT_FOUND" | "CANNOT_OFFER_OWN";
export type SupplierOfferResult =
  | { ok: true; offering: boolean }
  | { ok: false; error: SupplierOfferError };

// Comută starea (ridică ⇄ retrage mâna). userId ÎNTOTDEAUNA din sesiune — fără IDOR.
export async function toggleSupplierOffer(input: {
  userId: string;
  detailId: string;
}): Promise<SupplierOfferResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "TARGET_NOT_FOUND" };

  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };
  if (role.roleMain !== "FURNIZOR") return { ok: false, error: "NOT_FURNIZOR" };

  const detail = await getDetailById(input.detailId); // doar PUBLISHED
  if (!detail) return { ok: false, error: "TARGET_NOT_FOUND" };
  if (detail.authorId === input.userId) return { ok: false, error: "CANNOT_OFFER_OWN" };

  const already = await isSupplierOfferedByUser(input.userId, input.detailId);
  if (already) {
    await deleteSupplierOffer(input.userId, input.detailId);
    return { ok: true, offering: false };
  }

  await insertSupplierOffer(input.userId, input.detailId);
  const actor = await getNotificationActor(input.userId);
  await notifySupplierOffered({
    recipientUserId: detail.authorId,
    detailId: input.detailId,
    detailTitle: detail.title,
    supplierName: actor?.name ?? null,
  });
  return { ok: true, offering: true };
}

export async function getSupplierOffers(detailId: string) {
  if (!isUuid(detailId)) return [];
  return listSupplierOffersForDetail(detailId);
}

export async function isOfferingSupplier(userId: string, detailId: string): Promise<boolean> {
  if (!isUuid(detailId)) return false;
  return isSupplierOfferedByUser(userId, detailId);
}
