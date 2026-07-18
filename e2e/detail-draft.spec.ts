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

// „Salvează ciornă" pe formularul de adăugare detaliu (2026-07-06) — ciclu complet: salvează cu DOAR
// titlul (fără categorie/imagine) → apare în „Ciornele mele" (listă unificată cu ciornele de schiță) →
// se reia → se publică (validare strictă la publish, nu la save). Vezi și sketch-draft.spec.ts (analogul
// pt schițe) — pattern simetric.

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";


test.describe.serial("Ciornă de detaliu — salvează fără categorie/imagine, reia, publică", () => {
  const title = `E2E ciornă detaliu ${Date.now()}`;
  let detailId: string | null = null;

  test.afterAll(async () => {
    if (!detailId) return;
    const [row] = await db.select({ imageUrl: details.imageUrl }).from(details).where(eq(details.id, detailId));
    await db.delete(details).where(eq(details.id, detailId));
    if (row?.imageUrl) await deleteBlobs([row.imageUrl]);
  });

  test("Salvează ciornă cu DOAR titlul → rămâne DRAFT, redirect la editor", async ({ page }) => {
    await page.goto("/details/new");
    await page.locator("#title").fill(title);

    await page.getByRole("button", { name: "Salvează ciornă" }).click();

    await expect(page).toHaveURL(/\/details\/[0-9a-f-]+\/edit$/, { timeout: 15_000 });
    detailId = page.url().match(/\/details\/([0-9a-f-]+)\/edit/)?.[1] ?? null;
    expect(detailId).toBeTruthy();

    const [row] = await db
      .select({ status: details.status, imageUrl: details.imageUrl })
      .from(details)
      .where(eq(details.id, detailId!));
    expect(row?.status).toBe("DRAFT");
    expect(row?.imageUrl).toBeNull();

    await expect(page.getByRole("heading", { name: "Continuă ciorna" })).toBeVisible();
  });

  test("ciorna apare în lista unificată și se reia", async ({ page }) => {
    await page.goto("/sketches/drafts");
    // Cardul are 3 linkuri cu același href (imagine, titlu, „Continuă") → scope pe card + titlu explicit.
    const card = page.locator("article", { has: page.locator(`a[href="/details/${detailId}/edit"]`) });
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: title })).toBeVisible();
    await card.getByRole("link", { name: title }).click();

    await expect(page).toHaveURL(`/details/${detailId}/edit`);
  });

  test("publică ciorna (categorie + imagine acum obligatorii) → detaliu public", async ({ page }) => {
    const [category] = await pickLeafCategories(1);
    const tmpDir = mkdtempSync(path.join(tmpdir(), "detalia-e2e-draft-"));
    const imagePath = path.join(tmpDir, "tiny.png");
    writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

    await stripBypassHeadersForBlobUploads(page);
    await page.goto(`/details/${detailId}/edit`);

    // Fără categorie încă → publish trebuie să respingă (validare strictă abia la publish).
    await page.getByRole("button", { name: "Publică detaliul" }).click();
    // NU page.getByRole("alert") — Next.js are mereu în DOM un route-announcer (div role="alert",
    // aria-live) invizibil, care ar face locatorul strict-mode ambiguu (2 rezultate).
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(`/details/${detailId}/edit`);

    await page.getByRole("button", { name: "Alege categoriile…" }).click();
    await page.getByRole("button", { name: category.name, exact: true }).click();
    await page.keyboard.press("Escape");

    await page.locator("#image").setInputFiles(imagePath);
    await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publică detaliul" }).click();

    await expect(page).toHaveURL(`/details/${detailId}`, { timeout: 15_000 });
    // NU page.getByText(title) — titlul apare de 2 ori (breadcrumb + heading) → strict-mode violation.
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const [row] = await db.select({ status: details.status }).from(details).where(eq(details.id, detailId!));
    expect(row?.status).toBe("PUBLISHED");
  });
});

test("Ciornă de detaliu se șterge din lista de ciorne", async ({ page }) => {
  const title = `E2E ciornă ștearsă ${Date.now()}`;
  let detailId: string | null = null;

  try {
    await page.goto("/details/new");
    await page.locator("#title").fill(title);
    await page.getByRole("button", { name: "Salvează ciornă" }).click();
    await expect(page).toHaveURL(/\/details\/[0-9a-f-]+\/edit$/, { timeout: 15_000 });
    detailId = page.url().match(/\/details\/([0-9a-f-]+)\/edit/)?.[1] ?? null;

    await page.goto("/sketches/drafts");
    const row = page.locator("article", { has: page.locator(`a[href="/details/${detailId}/edit"]`) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Șterge ciorna" }).click();

    await expect(page.locator(`a[href="/details/${detailId}/edit"]`)).toHaveCount(0);

    // UI-ul e OPTIMIST (dispare instant) — server action-ul poate încă rula când ajungem aici.
    await expect(async () => {
      const remaining = await db.select().from(details).where(eq(details.id, detailId!));
      expect(remaining).toHaveLength(0);
    }).toPass({ timeout: 10_000 });
    detailId = null;
  } finally {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
  }
});
