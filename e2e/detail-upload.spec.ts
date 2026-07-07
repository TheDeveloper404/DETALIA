import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { details } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { pickLeafCategories } from "./category-helpers";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// Flux „upload de detaliu" prin formularul REAL (/details/new) — netestat până acum (integration.spec.ts
// acoperă doar createDetail() la nivel de service, ocolind formularul/upload-ul de imagine/categoria din UI).
// Upload real în Vercel Blob (PNG minim valid, generat aici) — reprocessBlobImage (SEC-02) validează
// conținutul real, nu doar extensia, deci un fișier fals ar pica silențios cu IMAGE_REQUIRED/INVALID_TYPE.

// PNG 1x1 roșu, valid, ~70 bytes — suficient pentru sharp (reprocessBlobImage) să-l accepte.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";


test("Adaugă detaliu: formular complet (titlu, categorie, imagine reală) → publicat + apare la /details/[id]", async ({
  page,
}) => {
  const [category] = await pickLeafCategories(1);
  const title = `E2E upload detaliu ${Date.now()}`;

  const tmpDir = mkdtempSync(path.join(tmpdir(), "detalia-e2e-"));
  const imagePath = path.join(tmpDir, "tiny.png");
  writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

  let detailId: string | null = null;
  let imageUrl: string | null = null;

  try {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/details/new");
    await expect(page).toHaveURL(/\/details\/new/);

    await page.locator("#title").fill(title);

    // Dropdown-ul de categorii (custom, nu <select> nativ) — deschide, bifează leaf-ul găsit, închide.
    await page.getByRole("button", { name: "Alege categoriile…" }).click();
    await page.getByRole("button", { name: category.name, exact: true }).click();
    await page.keyboard.press("Escape");

    await page.locator("#image").setInputFiles(imagePath);
    // Upload-ul client → Blob e async; preview-ul (buton „Înlocuiește") confirmă că imageUrl s-a completat.
    await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publică detaliul" }).click();

    await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 15_000 });
    // NU page.getByText(title) — titlul apare de 2 ori (breadcrumb + heading) → strict-mode violation.
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    detailId = page.url().split("/details/")[1] ?? null;
    expect(detailId).toBeTruthy();

    if (detailId) {
      const [row] = await db.select({ imageUrl: details.imageUrl }).from(details).where(eq(details.id, detailId));
      imageUrl = row?.imageUrl ?? null;
    }
  } finally {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
    if (imageUrl) await deleteBlobs([imageUrl]);
  }
});

test("Adaugă detaliu: fără categorie selectată → eroare de validare, fără redirect", async ({ page }) => {
  await page.goto("/details/new");
  await page.locator("#title").fill(`E2E fără categorie ${Date.now()}`);
  await page.getByRole("button", { name: "Publică detaliul" }).click();

  // NU page.getByRole("alert") — Next.js are mereu în DOM un route-announcer (role="alert") care ar
  // face locatorul strict-mode ambiguu.
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/details\/new/);
});
