import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { sketches } from "../db/schema";
import { deleteBlobs } from "../lib/storage";

// Numerotarea „schița N" per autor trebuie să fie STABILĂ după ordinea de creare (prima = 1, mereu) —
// NU recalculată după ordinea de afișare a taburilor (cea mai nouă primă). Bug raportat de Liviu
// 2026-07-07: la a doua schiță a aceluiași autor, prima devenea „schița 2" și a doua „schița 1".
// Fix: detail-workspace.tsx + comments-section.tsx calculează ordinalul după `createdAt` ascendent.

let cachedDetailUrl: string | null = null;
function detailUrl(): string {
  if (!cachedDetailUrl) {
    const seed = JSON.parse(
      readFileSync(path.resolve(__dirname, ".auth", "seed.json"), "utf8"),
    ) as { detailId: string };
    cachedDetailUrl = `/details/${seed.detailId}`;
  }
  return cachedDetailUrl;
}

// Pornește o schiță nouă peste detaliul seedat, desenează un stroke minim, publică. Întoarce id-ul.
async function createAndPublishSketch(page: Page): Promise<string> {
  await page.goto(detailUrl());
  await page.getByRole("button", { name: "Schițează peste detaliu" }).click();
  await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
  const sketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1];
  if (!sketchId) throw new Error("Nu am putut extrage sketchId din URL.");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas fără bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 40, y - 40);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.move(x + 40, y + 40, { steps: 5 });
  await page.mouse.up();

  const publishBtn = page.getByRole("button", { name: /Publică schița/ });
  await expect(publishBtn).toBeEnabled();
  await publishBtn.click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));

  return sketchId;
}

async function deleteSketches(ids: string[]): Promise<void> {
  const valid = ids.filter((id): id is string => !!id);
  if (valid.length === 0) return;
  const rows = await db
    .select({ thumbnailUrl: sketches.thumbnailUrl })
    .from(sketches)
    .where(eq(sketches.id, valid[0]!));
  for (const id of valid) await db.delete(sketches).where(eq(sketches.id, id));
  const urls = rows.map((r) => r.thumbnailUrl).filter((u): u is string => !!u);
  if (urls.length > 0) await deleteBlobs(urls);
}

test("numerotarea schițelor rămâne stabilă — prima creată e mereu schița 1", async ({ page }) => {
  let firstId: string | null = null;
  let secondId: string | null = null;

  try {
    firstId = await createAndPublishSketch(page);
    // Al doilea tab e cea mai nouă schiță → primul din strip (taburile arată cea mai nouă primă),
    // dar ordinalul ei trebuie să fie 2, nu 1 (fix-ul de azi).
    secondId = await createAndPublishSketch(page);

    // NU un query generic pe rol/nume (regex „schița" se poate potrivi și cu tab-uri ale altor spec-uri
    // rulate în paralel pe același cont+detaliu, ex. sketch.spec.ts) — țintim STRICT cele 2 schițe proprii,
    // după ID (data-testid stabil, vezi detail-workspace.tsx).
    await expect(page.getByTestId(`sketch-tab-${secondId}`)).toHaveAccessibleName("E2E Tester — schița 2");
    await expect(page.getByTestId(`sketch-tab-${firstId}`)).toHaveAccessibleName("E2E Tester — schița 1");
  } finally {
    await deleteSketches([firstId, secondId].filter((v): v is string => !!v));
  }
});
