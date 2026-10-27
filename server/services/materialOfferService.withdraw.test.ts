import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return await createTestDb();
});
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({ notifyMaterialOfferSent: vi.fn(), notifyMaterialOfferEdited: vi.fn() }));
const { db } = await import("@/db");
const { users, details, materialOffers, materialOfferFiles } = await import("@/db/schema");
const { deleteBlobs } = await import("@/lib/storage");
const { withdrawSupplierParticipation } = await import("./materialOfferService");

// Regula aprobata: "Da, amana stergerea si la retragere" — acelasi fisier poate fi folosit in doua oferte.
it("retrage oferta din DB fara a sterge fisierul pastrat de alta oferta", async () => {
  const supplierId = randomUUID(), ownerId = randomUUID();
  await db.insert(users).values([{ id: supplierId, email: "withdraw-supplier@test.local" }, { id: ownerId, email: "withdraw-owner@test.local" }]);
  const targets = await db.insert(details).values([{ authorId: ownerId, title: "Prima" }, { authorId: ownerId, title: "A doua" }]).returning();
  const offers = await db.insert(materialOffers).values(targets.map((detail) => ({ detailId: detail.id, supplierId, message: "Oferta" }))).returning();
  const url = `https://abc.public.blob.vercel-storage.com/u/${supplierId}/materials/shared.pdf`;
  await db.insert(materialOfferFiles).values(offers.map((offer) => ({ offerId: offer.id, url, fileName: "shared.pdf", fileSize: 100 })));

  expect(await withdrawSupplierParticipation({ userId: supplierId, detailId: targets[0].id })).toEqual({ ok: true });
  expect(await db.select().from(materialOffers).where(eq(materialOffers.id, offers[0].id))).toHaveLength(0);
  expect(await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, offers[0].id))).toHaveLength(0);
  expect(await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, offers[1].id))).toEqual([expect.objectContaining({ url })]);
  expect(deleteBlobs).not.toHaveBeenCalled();
});
