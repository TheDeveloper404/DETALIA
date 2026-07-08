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
    await saveButton.click();
    // Butonul e optimist (fire-and-forget) — aștept confirmarea (aria-pressed="true") înainte de a
    // naviga, altfel goto() poate anula request-ul către server înainte să ajungă la DB.
    await expect(saveButton).toHaveAttribute("aria-pressed", "true");

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
    await saveButton.click();
    // Butonul e optimist (fire-and-forget) — title/aria-pressed se schimbă imediat în UI; aștept
    // confirmarea (aria-pressed="false") înainte de a naviga, altfel goto() poate anula request-ul
    // către server înainte să ajungă la DB.
    await expect(saveButton).toHaveAttribute("aria-pressed", "false");

    await page.goto("/saved");
    // Verific specific detaliul nostru, NU starea globală goală — userul de test poate avea alte
    // detalii salvate (rulări anterioare/testare manuală pe DB shared), empty state n-ar fi garantat.
    await expect(page.getByRole("heading", { name: detailTitle })).not.toBeVisible();
  });
});
