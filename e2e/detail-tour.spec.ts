import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { getSeed } from "./seed";

// E2E — TUR GHIDAT pe pagina de detaliu (`DetailProductTour`). Acoperă exact ce `tsc`/`vitest` nu pot
// prinde: turul chiar pornește la prima vizită și, mai important, NU se închide instant — regresia
// exactă găsită 2026-08-17 la turul din feed (efectul depindea de un prop live, un re-render din cauze
// nelegate rula cleanup-ul). Fix-ul (`useState` snapshot la mount) e identic în ambele componente —
// acest test e „martorul" care ar prinde dacă cineva reintroduce dependența greșită.
//
// `describe.serial` OBLIGATORIU: mută `users.seen_detail_tour` pe userul de sesiune (shared state),
// la fel ca `supplier-offer.spec.ts` cu rolul — nu poate rula în paralel cu alt test din acest fișier.
// `auth.setup.ts` seedează userul cu flagul deja `true` (altfel turul ar porni nedeterminist la prima
// navigare a ORICĂRUI alt spec către un detaliu) — acest fișier îl resetează explicit la `false` doar
// pentru fereastra scurtă a testului, apoi îl restaurează.

function detailUrl(): string {
  return `/details/${getSeed().detailId}`;
}

test.describe.serial("Tur ghidat — pagina de detaliu", () => {
  test("prima vizită (flag nevăzut) → turul pornește, rămâne vizibil, marchează văzut", async ({ page }) => {
    const { testerUserId } = getSeed();
    await db.update(users).set({ seenDetailTour: false }).where(eq(users.id, testerUserId));

    try {
      await page.goto(detailUrl());

      const popover = page.locator(".detalia-tour-popover");
      await expect(popover).toBeVisible();
      await expect(popover.locator(".driver-popover-title")).toHaveText("Tab-uri");

      // Regresia exactă din 2026-08-17: turul se închidea instant, la o secundă de la primul pas —
      // verificăm că rămâne montat după o pauză, nu doar la primul frame.
      await page.waitForTimeout(1000);
      await expect(popover).toBeVisible();

      // Marcat „văzut" la mount (fire-and-forget) — verificăm efectul real în DB, nu doar UI-ul.
      await expect
        .poll(async () => {
          const [row] = await db
            .select({ seenDetailTour: users.seenDetailTour })
            .from(users)
            .where(eq(users.id, testerUserId));
          return row?.seenDetailTour;
        })
        .toBe(true);

      // Parcurge cei 4 pași până la capăt, fără eroare — confirmă că toate cele 4 ținte `data-tour`
      // există efectiv în DOM (dacă vreuna lipsește, driver.js sare pasul tăcut, dar aici verificăm
      // explicit titlurile fiecăruia, în ordine).
      await popover.locator(".driver-popover-next-btn").click();
      await expect(popover.locator(".driver-popover-title")).toHaveText("Schițează sau ofertă");
      await popover.locator(".driver-popover-next-btn").click();
      await expect(popover.locator(".driver-popover-title")).toHaveText("Validare pe roluri");
      await popover.locator(".driver-popover-next-btn").click();
      await expect(popover.locator(".driver-popover-title")).toHaveText("Dezbaterea");
      await popover.locator(".driver-popover-done-btn").click();
      await expect(popover).toHaveCount(0);
    } finally {
      await db.update(users).set({ seenDetailTour: true }).where(eq(users.id, testerUserId));
    }
  });

  test("a doua vizită (flag deja văzut) → turul NU mai pornește", async ({ page }) => {
    const { testerUserId } = getSeed();
    // Setup-ul global lasă flagul `true`; testul anterior îl restaurează oricum — reafirmăm explicit,
    // independent de ordinea de rulare din fișier.
    await db.update(users).set({ seenDetailTour: true }).where(eq(users.id, testerUserId));

    await page.goto(detailUrl());
    await expect(page.locator(".detalia-tour-popover")).toHaveCount(0);
  });
});
