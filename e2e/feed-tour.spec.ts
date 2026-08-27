import { expect, test } from "@playwright/test";

// E2E — TUR GHIDAT pe feed (`ProductTour`). Declanșat exclusiv prin `?tour=1` în URL (nu un flag
// persistat — vezi comentariul din product-tour.tsx), deci niciun setup/teardown de DB.
//
// Acoperă exact ce `tsc`/`vitest` nu pot: că toate cele 6 ținte `data-tour` există efectiv în DOM-ul
// paginii /feed la runtime, în ordinea din `TOUR_STEPS`. Doi pași au fost adăugați 2026-08-27
// (`my-content` din sidebar, `feed-first-card` pe primul detaliu) — dacă vreo țintă e redenumită sau
// mutată, driver.js sare pasul tăcut și acest test o prinde (asertează titlul fiecărui pas, în ordine).
//
// Proiectul `authed` rulează pe Desktop Chrome (1280px ≥ breakpoint `lg`), deci pasul `my-content`
// (sidebar `hidden lg:flex`) ESTE afișat aici; seed-ul are un detaliu PUBLISHED, deci și
// `feed-first-card` există. `getTourSteps` filtrează acești doi pași pe mobil / feed gol — acoperit de
// `components/product-tour.test.ts`, nu se re-testează aici.

test("tur feed: ?tour=1 → parcurge toți cei 6 pași, în ordine, fără eroare", async ({ page }) => {
  await page.goto("/feed?tour=1");

  const popover = page.locator(".detalia-tour-popover");
  await expect(popover).toBeVisible();

  const title = popover.locator(".driver-popover-title");
  const next = popover.locator(".driver-popover-next-btn");

  await expect(title).toHaveText("Categorii");

  // Regresia din 2026-08-17 (turul se închidea instant, la ~1s de la primul pas) — rămâne montat.
  await page.waitForTimeout(1000);
  await expect(popover).toBeVisible();

  await next.click();
  await expect(title).toHaveText("Profilul tău");
  await next.click();
  await expect(title).toHaveText("Conținutul tău");
  await next.click();
  await expect(title).toHaveText("Un detaliu în feed");
  await next.click();
  await expect(title).toHaveText("Adaugă");
  await next.click();
  await expect(title).toHaveText("Meniul tău");

  await popover.locator(".driver-popover-done-btn").click();
  await expect(popover).toHaveCount(0);

  // `?tour=1` a fost curățat din URL la pornire — refresh nu reporneste turul.
  await expect(page).toHaveURL(/\/feed$/);
});
