import { expect, test } from "@playwright/test";

import { getSeed } from "./seed";

// E2E — bookmark (salvare) din cardul de feed → apare pe /saved → unsave → dispare.
// Serial: pornim de la starea "nesalvat" (curățăm în beforeAll) ca rularea să fie determinist repetabilă.

test.describe.serial("Salvare detaliu (bookmark)", () => {
  test("salvează din feed → apare pe /saved", async ({ page }) => {
    const { detailId, detailTitle } = getSeed();
    const term = detailTitle.split(" ")[0];
    // ?q= (nu /feed simplu) — feed-ul e finit (~20, top interacțiuni); pe DB shared cu multe alte
    // detalii create de restul suitei, detaliul seedat (puține interacțiuni) poate ieși din top 20.
    await page.goto(`/feed?q=${encodeURIComponent(term)}`);

    // Butonul de bookmark NU e în interiorul <a href> (e sibling, în div-ul de conținut) — scopez pe
    // <article> (containerul DetailCard), nu pe ancoră.
    const card = page.locator(`article:has(a[href="/details/${detailId}"])`).first();
    await expect(card).toBeVisible();
    const saveButton = card.getByTitle(/Salvează detaliul|Salvat/);
    // Pornim de la nesalvat — dacă rularea anterioară a lăsat starea "salvat", resetăm.
    if ((await saveButton.getAttribute("aria-pressed")) === "true") {
      await saveButton.click();
      await page.waitForTimeout(300);
    }
    // Butonul e optimist (fire-and-forget) — aria-pressed se schimbă INSTANT (optimist), înainte ca
    // request-ul către server să se termine, deci a-l aștepta NU garantează round-trip-ul (confirmat de
    // eroarea reală din Sentry: "Failed to fetch" pe POST-ul întrerupt de goto() imediat următor).
    // waitForResponse pe POST-ul real (server action → POST la URL-ul curent) e singura garanție — dar
    // matcher-ul TREBUIE să fie pe URL exact, nu generic (altfel prinde orice alt POST concurent —
    // sentry-tunnel, vercel.live — care răspunde 200 mai devreme; bug confirmat din trace, 2026-07-08).
    const feedUrl = page.url();
    await Promise.all([
      page.waitForResponse((r) => r.url() === feedUrl && r.request().method() === "POST" && r.ok()),
      saveButton.click(),
    ]);

    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Detalii salvate" })).toBeVisible();
    await expect(page.getByRole("heading", { name: detailTitle })).toBeVisible();
  });

  test("scoate din salvate → dispare din listă", async ({ page }) => {
    const { detailId, detailTitle } = getSeed();
    await page.goto("/saved");

    const card = page.locator(`article:has(a[href="/details/${detailId}"])`).first();
    await expect(card).toBeVisible();
    const saveButton = card.getByTitle(/Salvează detaliul|Salvat/);
    // Vezi nota din testul de mai sus — aria-pressed e optimist, nu garantează round-trip-ul, iar
    // matcher-ul trebuie legat de URL-ul exact (nu generic „orice POST ok").
    const savedUrl = page.url();
    await Promise.all([
      page.waitForResponse((r) => r.url() === savedUrl && r.request().method() === "POST" && r.ok()),
      saveButton.click(),
    ]);

    await page.goto("/saved");
    // Verific specific detaliul nostru, NU starea globală goală — userul de test poate avea alte
    // detalii salvate (rulări anterioare/testare manuală pe DB shared), empty state n-ar fi garantat.
    await expect(page.getByRole("heading", { name: detailTitle })).not.toBeVisible();
  });
});
