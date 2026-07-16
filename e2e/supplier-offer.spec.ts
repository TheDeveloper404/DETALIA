import { expect, test } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { notifications, roles, supplierOffers } from "../db/schema";
import { toggleSupplierOffer } from "../server/services/supplierOfferService";
import { getSeed } from "./seed";

// „Ridic mâna" Furnizor — integrare reală (fără browser), la fel ca notifications.spec.ts: userii
// seed (tester/author) au rol PROIECTANT din auth.setup.ts, deci schimbăm temporar rolul la FURNIZOR
// pt durata testului și restaurăm PROIECTANT în `finally` — altfel stricăm alte spec-uri care rulează
// pe același user seedat.

async function setRole(userId: string, roleMain: "FURNIZOR" | "PROIECTANT") {
  await db.update(roles).set({ roleMain }).where(eq(roles.userId, userId));
}

test("toggle: primul click → oferă + notificare reală; al doilea → retrage, fără notificare nouă", async () => {
  const { detailId, testerUserId, authorUserId } = getSeed();

  // Curăță ORICE gunoi rămas din rulări anterioare întrerupte (test idempotent la pornire) — altfel un
  // eșec anterior (asertare picată înainte de cleanup) contaminează permanent rulările următoare.
  async function cleanup() {
    await db.delete(supplierOffers).where(and(eq(supplierOffers.userId, testerUserId), eq(supplierOffers.detailId, detailId)));
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
    expect(match).toBeTruthy();

    // al doilea click: retrage — rândul dispare, FĂRĂ notificare nouă (contor rămâne 1)
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
    expect(matchesAfter.length).toBe(1); // tot doar cea de la primul click
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
