// Service „ridic mâna" Furnizor — INIMA regulii: doar FURNIZOR (verificat din DB, nu din client) poate
// semnala că poate oferta materiale pe un detaliu. Reversibil (al doilea click retrage). Notificare
// in-app către autor DOAR la primul click (nu la fiecare retragere/reofertare).

import { isUuid } from "@/server/domain/ids";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  deleteSupplierOffer,
  insertSupplierOfferIfAbsent,
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

  // Tranziție ATOMICĂ (bug găsit 2026-07-16): decizia „a fost primul click?" o ia inserarea din DB
  // (`onConflictDoNothing().returning()`), NU o citire prealabilă — altfel dublu-click/tab dublu putea
  // trimite 2 notificări pentru un singur eveniment real (aceeași clasă de bug ca la validări, deja
  // rezolvată acolo prin `upsertDisapprovalIfTransition`).
  const insertedNow = await insertSupplierOfferIfAbsent(input.userId, input.detailId);
  if (!insertedNow) {
    // Exista deja → acest click e o retragere (sau a pierdut cursa de inserare — oricum, rezultatul
    // corect e retragerea, nu o a doua notificare).
    await deleteSupplierOffer(input.userId, input.detailId);
    return { ok: true, offering: false };
  }

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
