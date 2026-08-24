import { expect, test } from "@playwright/test";
import { like } from "drizzle-orm";

import { db } from "../db";
import { details } from "../db/schema";
import { FEED_PAGE_SIZE } from "../server/domain/detail";
import { getSeed } from "./seed";

// Paginare feed (decizie 2026-08-16): 50/pagină, stil forum (Anterior/Următor + numere), NU scroll
// infinit. `TAG` unic pe rulare izolează seed-ul acestui test de restul feed-ului (căutare `?q=`),
// ca numărul de carduri per pagină să fie exact predictibil, indiferent ce mai există în DB.
const TAG = `e2epag${Date.now()}`;
const TOTAL = FEED_PAGE_SIZE + 5; // forțează exact 2 pagini: 50 + 5

test.describe.serial("Paginare feed (50/pagină)", () => {
  test.beforeAll(async () => {
    const { testerUserId } = getSeed();
    // Insert direct în DB (nu prin createDetail): testul verifică paginarea, nu regulile de creare —
    // un insert simplu e suficient și de ~50x mai rapid decât 55 de apeluri de service secvențiale.
    await db.insert(details).values(
      Array.from({ length: TOTAL }, (_, i) => ({
        title: `${TAG} detaliu ${i + 1}`,
        authorId: testerUserId,
        imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
        status: "PUBLISHED",
      })),
    );
  });

  test.afterAll(async () => {
    await db.delete(details).where(like(details.title, `${TAG}%`));
  });

  test("pagina 1 arată 50 de rezultate + link spre pagina 2, pagina 2 arată restul de 5", async ({
    page,
  }) => {
    await page.goto(`/feed?q=${TAG}`);

    const nav = page.getByRole("navigation", { name: "Paginare feed" });
    await expect(nav).toBeVisible();
    await expect(page.locator("article")).toHaveCount(FEED_PAGE_SIZE);

    await nav.getByRole("link", { name: "Pagina 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("article")).toHaveCount(TOTAL - FEED_PAGE_SIZE);

    // Filtrul de căutare (?q=) rămâne activ pe a doua pagină — nu se pierde la navigare.
    await expect(page).toHaveURL(new RegExp(`q=${TAG}`));
  });

  test("?page= peste ultima pagină reală → redirect la ultima pagină validă, nu «Niciun rezultat»", async ({
    page,
  }) => {
    await page.goto(`/feed?q=${TAG}&page=99`);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("Niciun Rezultat")).toHaveCount(0);
    await expect(page.locator("article")).toHaveCount(TOTAL - FEED_PAGE_SIZE);
  });
});
