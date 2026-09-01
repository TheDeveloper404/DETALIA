import { expect, test } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { materialOfferFiles, materialOffers, notifications, roles, supplierOffers } from "../db/schema";
import {
  getMaterialOffersForOwner,
  getMyMaterialOffer,
  sendOrUpdateMaterialOffer,
  withdrawSupplierParticipation,
} from "../server/services/materialOfferService";
import { insertSupplierOfferIfAbsent } from "../server/repos/supplierOffersRepo";
import { getSeed } from "./seed";

// Ofertă de materiale (Furnizor → autor) — integrare reală (fără browser, la fel ca supplier-offer.spec.ts):
// exercită service + repo + DB reale, ca să prindă exact tiparul de bug recidivat pe acest proiect
// (subquery corelat greșit / poartă de acces omisă), pe care mock-urile din testele unitare NU-l pot prinde.
//
// `describe.serial` OBLIGATORIU: testele mută rolul lui `testerUserId` (shared state pe DB) — nu pot
// rula în paralel cu alte spec-uri care fac același lucru (vezi supplier-offer.spec.ts, motivul identic).

async function setRole(userId: string, roleMain: "FURNIZOR" | "PROIECTANT") {
  await db.update(roles).set({ roleMain }).where(eq(roles.userId, userId));
}

// SEC-N02 (2026-09-01): `sendOrUpdateMaterialOffer` verifică ACUM `isUsersBlobUrl` — URL-ul trebuie
// să fie în store-ul nostru real ȘI în namespace-ul `/u/<userId>/` al furnizorului. Derivăm store-ul
// din token exact ca `lib/blob-url.ts`, ca fixture-urile să treacă și cu Blob configurat, și fără.
const STORE_ID = process.env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1]?.toLowerCase();
const BLOB_HOST = STORE_ID
  ? `${STORE_ID}.public.blob.vercel-storage.com`
  : "e2e.public.blob.vercel-storage.com";

function fileFor(userId: string, name = "lista.pdf") {
  return { url: `https://${BLOB_HOST}/u/${userId}/materials/${name}`, fileName: name, fileSize: 1024 };
}

test.describe.serial("material offer", () => {
  test("trimitere → rând + fișier + notificare MATERIAL_OFFER_SENT; editare → notificare EDITED, nu Sent din nou", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();

    async function cleanup() {
      await db.delete(materialOffers).where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      await db.delete(notifications).where(
        and(
          eq(notifications.recipientUserId, authorUserId),
          sql`payload_json->>'detailId' = ${detailId}`,
          sql`type in ('MATERIAL_OFFER_SENT', 'MATERIAL_OFFER_EDITED')`,
        ),
      );
    }
    await cleanup();
    await setRole(testerUserId, "FURNIZOR");
    try {
      const r1 = await sendOrUpdateMaterialOffer({
        userId: testerUserId,
        detailId,
        message: "Am atașat lista cu materiale",
        files: [fileFor(testerUserId)],
      });
      expect(r1).toEqual({ ok: true, isNew: true });

      const [offerRow] = await db
        .select()
        .from(materialOffers)
        .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      expect(offerRow).toBeTruthy();

      const fileRows = await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, offerRow.id));
      expect(fileRows).toHaveLength(1);
      expect(fileRows[0].fileName).toBe("lista.pdf");

      const sentRows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "MATERIAL_OFFER_SENT")));
      expect(sentRows.some((n) => (n.payloadJson as { detailId?: string })?.detailId === detailId)).toBe(true);

      // Editare: ACEEAȘI acțiune (upsert) — oferta existentă, notificare EDITED, nu un al doilea SENT.
      const r2 = await sendOrUpdateMaterialOffer({
        userId: testerUserId,
        detailId,
        message: "Mesaj actualizat, am adăugat un fișier",
        files: [fileFor(testerUserId), fileFor(testerUserId, "preturi.xlsx")],
      });
      expect(r2).toEqual({ ok: true, isNew: false });

      const [offerRowAfter] = await db
        .select()
        .from(materialOffers)
        .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      expect(offerRowAfter.id).toBe(offerRow.id); // ACELAȘI rând, nu un duplicat (unique index)
      expect(offerRowAfter.message).toBe("Mesaj actualizat, am adăugat un fișier");

      const fileRowsAfter = await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, offerRow.id));
      expect(fileRowsAfter).toHaveLength(2);

      const editedRows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "MATERIAL_OFFER_EDITED")));
      expect(editedRows.some((n) => (n.payloadJson as { detailId?: string })?.detailId === detailId)).toBe(true);

      const sentRowsAfter = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "MATERIAL_OFFER_SENT")));
      expect(sentRowsAfter.filter((n) => (n.payloadJson as { detailId?: string })?.detailId === detailId)).toHaveLength(1); // tot doar cel de la trimitere
    } finally {
      await cleanup();
      await setRole(testerUserId, "PROIECTANT");
    }
  });

  test("gating pe rol — non-FURNIZOR → NOT_FURNIZOR, fără scriere", async () => {
    const { detailId, testerUserId } = getSeed();
    const r = await sendOrUpdateMaterialOffer({ userId: testerUserId, detailId, message: "Bună", files: [fileFor(testerUserId)] });
    expect(r).toEqual({ ok: false, error: "NOT_FURNIZOR" });
  });

  test("nu poți oferta pe propriul detaliu — CANNOT_OFFER_OWN", async () => {
    const { detailId, authorUserId } = getSeed();
    await setRole(authorUserId, "FURNIZOR");
    try {
      const r = await sendOrUpdateMaterialOffer({ userId: authorUserId, detailId, message: "Bună", files: [fileFor(authorUserId)] });
      expect(r).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });
    } finally {
      await setRole(authorUserId, "PROIECTANT");
    }
  });

  // Adversarial (CRITICAL — vizibilitate strict privată, 2026-08-25): furnizorul care a TRIMIS oferta
  // NU e autorul detaliului — `getMaterialOffersForOwner` chemat cu userId-ul furnizorului (nu al
  // autorului) trebuie să întoarcă listă GOALĂ, nu oferta lui. Prinde exact tiparul de bug recidivat
  // pe acest proiect (verificare de acces omisă/greșită pe o cale nouă de citire).
  test("privacy — doar autorul detaliului vede oferta prin getMaterialOffersForOwner, furnizorul NU", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();

    async function cleanup() {
      await db.delete(materialOffers).where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
    }
    await cleanup();
    await setRole(testerUserId, "FURNIZOR");
    try {
      await sendOrUpdateMaterialOffer({ userId: testerUserId, detailId, message: "Bună", files: [fileFor(testerUserId)] });

      const forOwner = await getMaterialOffersForOwner(authorUserId, detailId);
      expect(forOwner.some((o) => o.supplierId === testerUserId)).toBe(true);

      // Chiar furnizorul care a trimis-o, chemând accesorul de PROPRIETAR → gol (nu e proprietarul).
      const forSupplier = await getMaterialOffersForOwner(testerUserId, detailId);
      expect(forSupplier).toEqual([]);

      // Accesorul propriu al furnizorului (`getMyMaterialOffer`) tot funcționează — canal separat.
      const mine = await getMyMaterialOffer(testerUserId, detailId);
      expect(mine?.message).toBe("Bună");
    } finally {
      await cleanup();
      await setRole(testerUserId, "PROIECTANT");
    }
  });

  test("retragere (withdrawSupplierParticipation) — oferta+fișierele dispar ȘI mâna coboară, o singură acțiune", async () => {
    const { detailId, testerUserId } = getSeed();
    await setRole(testerUserId, "FURNIZOR");
    try {
      // „Mâna ridicată" (supplier_offers) — precondiție reală: modalul se deschide DUPĂ ridicare.
      await insertSupplierOfferIfAbsent(testerUserId, detailId);
      await sendOrUpdateMaterialOffer({ userId: testerUserId, detailId, message: "Bună", files: [fileFor(testerUserId)] });
      const [offerRow] = await db
        .select()
        .from(materialOffers)
        .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      expect(offerRow).toBeTruthy();

      const res = await withdrawSupplierParticipation({ userId: testerUserId, detailId });
      expect(res).toEqual({ ok: true });

      const [offerRowAfter] = await db
        .select()
        .from(materialOffers)
        .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      expect(offerRowAfter).toBeUndefined();

      const fileRowsAfter = await db.select().from(materialOfferFiles).where(eq(materialOfferFiles.offerId, offerRow.id));
      expect(fileRowsAfter).toHaveLength(0); // cascade FK

      const [handRowAfter] = await db
        .select()
        .from(supplierOffers)
        .where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
      expect(handRowAfter).toBeUndefined(); // mâna a coborât — starea e complet inițială
    } finally {
      await db.delete(materialOffers).where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      await db.delete(supplierOffers).where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
      await setRole(testerUserId, "PROIECTANT");
    }
  });

  // SEC-N02 (recidivă SEC-N01, 2026-09-01): un FURNIZOR atașează pe ofertă URL-ul Blob al ALTUI user
  // (namespace `/u/<authorUserId>/`, nu al lui). Fără gardul `isUsersBlobUrl` din service, oferta ar
  // fi salvată, iar la editare/retragere `deleteBlobs` ar șterge fișierul victimei din storage.
  test("SEC-N02 — fișier Blob din namespace-ul altui user → INVALID_FILE, fără rând scris", async () => {
    const { detailId, testerUserId, authorUserId } = getSeed();

    async function cleanup() {
      await db.delete(materialOffers).where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
    }
    await cleanup();
    await setRole(testerUserId, "FURNIZOR");
    try {
      const foreign = fileFor(authorUserId, "victima.pdf"); // /u/<authorUserId>/... — nu al lui testerUserId
      const r = await sendOrUpdateMaterialOffer({ userId: testerUserId, detailId, message: "Bună", files: [foreign] });
      expect(r).toEqual({ ok: false, error: "INVALID_FILE" });

      const rows = await db
        .select()
        .from(materialOffers)
        .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, testerUserId)));
      expect(rows).toHaveLength(0);
    } finally {
      await cleanup();
      await setRole(testerUserId, "PROIECTANT");
    }
  });
});
