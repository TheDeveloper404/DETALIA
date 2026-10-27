import { eq } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const test = await createTestDb();
  // Adaptarea executa SQL-urile reale pentru verificarea URL-urilor; nu simuleaza tranzactia Neon.
  Object.assign(test.db, { batch: async (queries: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const query of queries) results.push(await query);
    return results;
  } });
  return test;
});
const { db, client } = await import("@/db") as typeof import("@/db") & { client: { close: () => Promise<void> } };
const { users, details, materialOffers, materialOfferFiles, detailResources } = await import("@/db/schema");
const { deleteMaterialOffersForDetail } = await import("./materialOffersRepo");
const { deleteDetailCascade } = await import("./detailsRepo");
afterAll(() => client.close());

async function fixture() {
  const suffix = crypto.randomUUID();
  const [supplier, firstOwner, secondOwner] = await db.insert(users).values([
    { email: `supplier-${suffix}@test.local` }, { email: `owner-a-${suffix}@test.local` }, { email: `owner-b-${suffix}@test.local` },
  ]).returning();
  const [first, second] = await db.insert(details).values([
    { authorId: firstOwner.id, title: "Prima" }, { authorId: secondOwner.id, title: "A doua" },
  ]).returning();
  const offers = await db.insert(materialOffers).values([
    { detailId: first.id, supplierId: supplier.id, message: "Prima" }, { detailId: second.id, supplierId: supplier.id, message: "A doua" },
  ]).returning();
  const url = `https://store.test/u/${supplier.id}/materials/shared.pdf`;
  await db.insert(materialOfferFiles).values(offers.map((offer) => ({ offerId: offer.id, url, fileName: "shared.pdf", fileSize: 100 })));
  return { first, secondOffer: offers[1], url };
}

// Regula aprobata: "Da, aplica regula tuturor atasamentelor ofertelor" — pastrare fizica si la stergere/retragere detaliu sau proiect.
it("anonimizarea detaliului elimina ofertele fara sa colecteze fisierele lor pentru stergere", async () => {
  const { first, secondOffer, url } = await fixture();
  expect(await deleteMaterialOffersForDetail(first.id)).toBeUndefined();
  expect(await db.select().from(materialOffers).where(eq(materialOffers.detailId, first.id))).toHaveLength(0);
  expect(await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, secondOffer.id))).toEqual([expect.objectContaining({ url })]);
});

// Regula aprobata: "Da, aplica regula tuturor atasamentelor ofertelor" — restul fisierelor detaliului isi pastreaza stergerea existenta.
it("cascada detaliu/proiect pastreaza atasamentele ofertelor, dar continua curatenia resurselor detaliului", async () => {
  const { first, secondOffer, url } = await fixture();
  const resourceUrl = "https://store.test/detail-resource.pdf";
  await db.insert(detailResources).values({ detailId: first.id, type: "PDF", url: resourceUrl });
  const candidates = await deleteDetailCascade(first.id);
  expect(candidates).not.toContain(url);
  expect(candidates).toContain(resourceUrl);
  expect(await db.select().from(details).where(eq(details.id, first.id))).toHaveLength(0);
  expect(await db.select().from(materialOffers).where(eq(materialOffers.detailId, first.id))).toHaveLength(0);
  expect(await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, secondOffer.id))).toEqual([expect.objectContaining({ url })]);
});
