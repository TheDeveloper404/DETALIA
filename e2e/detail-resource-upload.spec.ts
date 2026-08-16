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

// E2E — resursă IMAGE încărcată la /details/new (2026-08-16, raportat Liviu: „dacă văd un link
// kilometric nu știu ce e cu el"). Acoperă exact ce testul unitar (`looksLikeUploadedResource`) NU
// poate: interacțiunea reală (upload de fișier → link-ul dispare, apare previzualizarea compactă) —
// singura cale să prindem o regresie unde componenta randează greșit indiferent ce spune heuristica.

// PNG 1x1 roșu, valid — identic cu cel din detail-upload.spec.ts (sharp acceptă conținutul real).
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeImage(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "detalia-resource-"));
  const file = path.join(dir, name);
  writeFileSync(file, Buffer.from(TINY_PNG_BASE64, "base64"));
  return file;
}

test("Resursă IMAGE încărcată: link-ul dispare, apare previzualizare compactă; „Schimbă” revine la câmpul de text", async ({
  page,
}) => {
  const [category] = await pickLeafCategories(1);
  const title = `E2E resursă upload ${Date.now()}`;
  let detailId: string | null = null;
  let mainImageUrl: string | null = null;

  try {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/details/new");
    await page.locator("#title").fill(title);
    await page.getByRole("button", { name: "Alege categoriile…" }).click();
    await page.getByRole("button", { name: category.name, exact: true }).click();
    await page.keyboard.press("Escape");

    await page.locator("#image").setInputFiles(makeImage("detaliu.png"));
    await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

    // Un rând nou de resursă pornește ca LINK (tip implicit) — comutăm pe Imagine ca să declanșăm
    // fluxul de upload (nu doar link lipit de mână).
    await page.getByRole("button", { name: "Adaugă resursă" }).click();
    const resourcesList = page.getByTestId("resources-list");
    await resourcesList.getByLabel("Tip resursă 1").selectOption("IMAGE");

    // ÎNAINTE de upload: câmpul de text e vizibil, gol — nimic de ascuns încă.
    const textField = resourcesList.locator('input[type="text"]');
    await expect(textField).toBeVisible();
    await expect(textField).toHaveValue("");

    // Upload real prin butonul dedicat resursei (input file ascuns în spatele lui) — NU câmpul
    // principal de imagine, deja completat mai sus.
    await resourcesList.locator('input[type="file"]').setInputFiles(makeImage("resursa.png"));

    // DUPĂ upload: link-ul kilometric NU mai e vizibil — dispare câmpul de text, apare previzualizarea
    // compactă („Încărcat" + thumbnail + „Schimbă"). Bug real reparat: înainte, link-ul rămânea afișat.
    await expect(resourcesList.getByText("Încărcat")).toBeVisible({ timeout: 15_000 });
    await expect(textField).toHaveCount(0);
    // Thumbnail-ul e o imagine reală (Next Image), nu doar text — confirmă previzualizarea, nu un placeholder gol.
    await expect(resourcesList.locator("img")).toBeVisible();

    // „Schimbă" revine explicit la câmpul de text (gol) + butonul de upload — nu rămâne blocat pe
    // previzualizare dacă userul vrea să încarce alt fișier sau să lipească un link.
    await resourcesList.getByRole("button", { name: "Schimbă" }).click();
    await expect(textField).toBeVisible();
    await expect(textField).toHaveValue("");
    await expect(resourcesList.getByText("Încărcat")).toHaveCount(0);

    // Re-încarcă (pentru fluxul de publicare complet) și publică — dovadă că formularul funcționează
    // capăt la capăt, nu doar starea locală a previzualizării.
    await resourcesList.locator('input[type="file"]').setInputFiles(makeImage("resursa2.png"));
    await expect(resourcesList.getByText("Încărcat")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publică detaliul" }).click();
    await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 15_000 });
    detailId = page.url().split("/details/")[1] ?? null;
    expect(detailId).toBeTruthy();

    if (detailId) {
      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId));
      mainImageUrl = row?.imageUrl ?? null;
    }
  } finally {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
    if (mainImageUrl) await deleteBlobs([mainImageUrl]);
  }
});

test("Resursă LINK: câmpul de text rămâne mereu vizibil (niciodată previzualizare compactă)", async ({
  page,
}) => {
  const [category] = await pickLeafCategories(1);
  const title = `E2E resursă link ${Date.now()}`;

  await stripBypassHeadersForBlobUploads(page);
  await page.goto("/details/new");
  await page.locator("#title").fill(title);
  await page.getByRole("button", { name: "Alege categoriile…" }).click();
  await page.getByRole("button", { name: category.name, exact: true }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Adaugă resursă" }).click();
  const resourcesList = page.getByTestId("resources-list");
  // LINK e tipul implicit — nu-l schimbăm. Userul tastează un link extern de mână.
  const textField = resourcesList.locator('input[type="text"]');
  await textField.fill("https://normativ.example.com/P100-1");

  await expect(textField).toBeVisible();
  await expect(resourcesList.getByText("Încărcat")).toHaveCount(0);
  // LINK n-are buton de upload deloc (UPLOADABLE_RESOURCE_TYPES nu-l include).
  await expect(resourcesList.locator('input[type="file"]')).toHaveCount(0);
});
