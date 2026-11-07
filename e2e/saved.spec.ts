import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { savedDetails } from "../db/schema";
import { getSeed } from "./seed";

// E2E — bookmark (salvare) din cardul de feed → apare pe /saved → unsave → dispare.
// Serial: pornim de la starea "nesalvat" (curățăm în beforeAll) ca rularea să fie determinist repetabilă.

test.describe.serial("Salvare detaliu (bookmark)", () => {
  test.beforeAll(async () => {
    const { testerUserId, detailId } = getSeed();
    await db.delete(savedDetails).where(and(eq(savedDetails.userId, testerUserId), eq(savedDetails.detailId, detailId)));
  });

  test("salvează din feed → apare pe /saved", async ({ page }) => {
    const { detailId, detailTitle, testerUserId } = getSeed();
    const term = detailTitle.split(" ")[0];
    // ?q= (nu /feed simplu) — feed-ul e finit (~20, top interacțiuni); pe DB shared cu multe alte
    // detalii create de restul suitei, detaliul seedat (puține interacțiuni) poate ieși din top 20.
    await page.goto(`/feed?q=${encodeURIComponent(term)}`);

    // Butonul de bookmark NU e în interiorul <a href> (e sibling, în div-ul de conținut) — scopez pe
    // <article> (containerul DetailCard), nu pe ancoră.
    const card = page.locator(`article:has(a[href="/details/${detailId}"])`).first();
    await expect(card).toBeVisible();
    const saveButton = card.getByTitle(/Salvează detaliul|Salvat/);
    await expect(saveButton).toHaveAttribute("aria-pressed", "false");
    await saveButton.click();
    // Asteptam efectul persistent: aria-pressed este optimist, iar corpul RSC poate ramane deschis
    // dupa salvare (trace 2026-11-07: finished expira, dar bookmark-ul exista deja in DB).
    await expect.poll(async () => (await db.select().from(savedDetails)
      .where(and(eq(savedDetails.userId, testerUserId), eq(savedDetails.detailId, detailId)))).length).toBe(1);

    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Detalii salvate" })).toBeVisible();
    await expect(page.getByRole("heading", { name: detailTitle })).toBeVisible();
  });

  test("scoate din salvate → dispare din listă", async ({ page }) => {
    const { detailId, detailTitle, testerUserId } = getSeed();
    await page.goto("/saved");

    const card = page.locator(`article:has(a[href="/details/${detailId}"])`).first();
    await expect(card).toBeVisible();
    const saveButton = card.getByTitle(/Salvează detaliul|Salvat/);
    await expect(saveButton).toHaveAttribute("aria-pressed", "true");
    await saveButton.click();
    await expect.poll(async () => (await db.select().from(savedDetails)
      .where(and(eq(savedDetails.userId, testerUserId), eq(savedDetails.detailId, detailId)))).length).toBe(0);

    await page.goto("/saved");
    // Verific specific detaliul nostru, NU starea globală goală — userul de test poate avea alte
    // detalii salvate (rulări anterioare/testare manuală pe DB shared), empty state n-ar fi garantat.
    await expect(page.getByRole("heading", { name: detailTitle })).not.toBeVisible();
  });
});
