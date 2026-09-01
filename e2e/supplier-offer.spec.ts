import { expect, test } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db";
import {
  materialOfferFiles,
  materialOffers,
  notifications,
  roles,
  savedDetails,
  supplierOffers,
} from "../db/schema";
import { listOfferedDetails } from "../server/repos/detailsRepo";
import { insertSupplierOfferIfAbsent } from "../server/repos/supplierOffersRepo";
import {
  getMaterialOffersForOwner,
  getMyMaterialOffer,
  sendOrUpdateMaterialOffer,
  withdrawSupplierParticipation,
} from "../server/services/materialOfferService";
import { toggleSupplierOffer } from "../server/services/supplierOfferService";
import { getSeed } from "./seed";

// „Ridic mâna" Furnizor + „Ofertă de materiale" — integrare reală (fără browser), la fel ca
// notifications.spec.ts: userii seed (tester/author) au rol PROIECTANT din auth.setup.ts, deci
// schimbăm temporar rolul la FURNIZOR pt durata testului și restaurăm PROIECTANT în `finally`.
//
// AMBELE flow-uri stau în ACELAȘI fișier (comasat 2026-09-01): mută rolul aceluiași `testerUserId`
// (shared state pe DB) și Playwright NU are serializare cross-fișier — două `describe.serial` în
// fișiere separate, în același proiect, rulează pe workeri diferiți în paralel, iar `finally`-ul
// unuia resetează rolul chiar în timp ce celălalt e la mijloc (`NOT_FURNIZOR` aleator). Într-un
// singur fișier, cele două blocuri serial rulează consecutiv pe același worker.

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

test.describe.serial("supplier offer", () => {
// FĂRĂ notificare la ridicarea mâinii (2026-08-26, feedback: notificarea reală trebuie să vină STRICT
// la trimiterea conținutului ofertei — materialOfferService, nu de aici). Testul verifică explicit
// absența ei, nu doar toggle-ul rândului din `supplier_offers`.
test("toggle: primul click → oferă (FĂRĂ notificare); al doilea → retrage", async () => {
  const { detailId, testerUserId, authorUserId } = getSeed();

  // Curăță ORICE gunoi rămas din rulări anterioare întrerupte (test idempotent la pornire) — altfel un
  // eșec anterior (asertare picată înainte de cleanup) contaminează permanent rulările următoare.
  async function cleanup() {
    await db.delete(supplierOffers).where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
    // Auto-save-ul din toggleSupplierOffer a fost eliminat (2026-08-26 — „Ofertele mele" acoperă acum
    // acest scop) — delete-ul rămâne strict defensiv, pentru cazul unui bookmark pus manual în test.
    await db.delete(savedDetails).where(and(eq(savedDetails.userId, testerUserId), eq(savedDetails.detailId, detailId)));
    await db.delete(notifications).where(
      and(
        eq(notifications.recipientUserId, authorUserId),
        eq(notifications.type, "SUPPLIER_OFFERED"),
        sql`payload_json->>'detailId' = ${detailId}`,
      ),
    );
  }
  await cleanup();

  await setRole(testerUserId, "FURNIZOR");
  try {
    const r1 = await toggleSupplierOffer({ userId: testerUserId, detailId });
    expect(r1).toEqual({ ok: true, offering: true });

    const [offerRow] = await db
      .select()
      .from(supplierOffers)
      .where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
    expect(offerRow).toBeTruthy();

    const notifRows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "SUPPLIER_OFFERED")));
    const match = notifRows.find((n) => (n.payloadJson as { detailId?: string })?.detailId === detailId);
    expect(match).toBeUndefined();

    // al doilea click: retrage — rândul dispare, tot fără notificare
    const r2 = await toggleSupplierOffer({ userId: testerUserId, detailId });
    expect(r2).toEqual({ ok: true, offering: false });

    const [offerRowAfter] = await db
      .select()
      .from(supplierOffers)
      .where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
    expect(offerRowAfter).toBeUndefined();

    const notifRowsAfter = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "SUPPLIER_OFFERED")));
    const matchesAfter = notifRowsAfter.filter(
      (n) => (n.payloadJson as { detailId?: string })?.detailId === detailId,
    );
    expect(matchesAfter.length).toBe(0);
  } finally {
    // NECONDIȚIONAT — rulează chiar dacă o asertare de mai sus a picat, altfel rândurile rămân
    // orfane și contaminează următoarea rulare (bug găsit 2026-07-16: exact asta s-a întâmplat).
    await cleanup();
    await setRole(testerUserId, "PROIECTANT");
  }
});

test("gating pe rol — user fără rol FURNIZOR → NOT_FURNIZOR, fără scriere", async () => {
  const { detailId, testerUserId } = getSeed();
  // testerUserId rămâne PROIECTANT (rolul lui implicit din auth.setup.ts) — nu-l schimbăm aici.
  const r = await toggleSupplierOffer({ userId: testerUserId, detailId });
  expect(r).toEqual({ ok: false, error: "NOT_FURNIZOR" });

  const [row] = await db
    .select()
    .from(supplierOffers)
    .where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
  expect(row).toBeUndefined();
});

test("nu poți oferta pe propriul detaliu — CANNOT_OFFER_OWN", async () => {
  const { detailId, authorUserId } = getSeed();

  await setRole(authorUserId, "FURNIZOR");
  try {
    const r = await toggleSupplierOffer({ userId: authorUserId, detailId });
    expect(r).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });

    const [row] = await db
      .select()
      .from(supplierOffers)
      .where(and(eq(supplierOffers.userId, authorUserId), eq(supplierOffers.detailId, detailId)));
    expect(row).toBeUndefined();
  } finally {
    await setRole(authorUserId, "PROIECTANT");
  }
});

test("toggleSupplierOffer — detaliul ofertat apare în listOfferedDetails, dispare la retragere", async () => {
  const { detailId, testerUserId } = getSeed();

  async function cleanup() {
    await db.delete(supplierOffers).where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
    await db.delete(savedDetails).where(and(eq(savedDetails.userId, testerUserId), eq(savedDetails.detailId, detailId)));
  }
  await cleanup();

  await setRole(testerUserId, "FURNIZOR");
  try {
    const before = await listOfferedDetails(testerUserId);
    expect(before.some((d) => d.id === detailId)).toBe(false);

    await toggleSupplierOffer({ userId: testerUserId, detailId });
    const after = await listOfferedDetails(testerUserId);
    expect(after.some((d) => d.id === detailId)).toBe(true);

    // retragere (al doilea toggle) → dispare din listă (nu doar din supplier_offers, ci și din rezultat)
    await toggleSupplierOffer({ userId: testerUserId, detailId });
    const afterRetract = await listOfferedDetails(testerUserId);
    expect(afterRetract.some((d) => d.id === detailId)).toBe(false);
  } finally {
    await cleanup();
    await setRole(testerUserId, "PROIECTANT");
  }
});

});

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
