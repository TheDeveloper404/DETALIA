// Repo „ridic mâna" Furnizor — singurul loc cu acces Drizzle pentru `supplier_offers`.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { roles, supplierOffers, users } from "@/db/schema";

// Idempotent: dacă a ridicat deja mâna, nu face nimic (PK compus) — evită notificare dublă la dublu-click.
export async function insertSupplierOffer(userId: string, detailId: string) {
  await db
    .insert(supplierOffers)
    .values({ userId, detailId })
    .onConflictDoNothing({ target: [supplierOffers.userId, supplierOffers.detailId] });
}

export async function deleteSupplierOffer(userId: string, detailId: string) {
  await db
    .delete(supplierOffers)
    .where(and(eq(supplierOffers.userId, userId), eq(supplierOffers.detailId, detailId)));
}

export async function isSupplierOfferedByUser(userId: string, detailId: string): Promise<boolean> {
  const [row] = await db
    .select({ one: supplierOffers.userId })
    .from(supplierOffers)
    .where(and(eq(supplierOffers.userId, userId), eq(supplierOffers.detailId, detailId)))
    .limit(1);
  return !!row;
}

// Lista publică a Furnizorilor care au ridicat mâna pe acest detaliu (nume + rol + avatar, ca la validare).
export async function listSupplierOffersForDetail(detailId: string) {
  return db
    .select({
      userId: supplierOffers.userId,
      createdAt: supplierOffers.createdAt,
      userName: users.name,
      userImage: users.image,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
    })
    .from(supplierOffers)
    .leftJoin(users, eq(users.id, supplierOffers.userId))
    .leftJoin(roles, eq(roles.userId, supplierOffers.userId))
    .where(eq(supplierOffers.detailId, detailId))
    .orderBy(desc(supplierOffers.createdAt));
}

export type SupplierOfferRow = Awaited<ReturnType<typeof listSupplierOffersForDetail>>[number];
