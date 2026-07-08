import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { sketches } from "../db/schema";
import { deleteBlobs } from "../lib/storage";

// E2E — ciclul complet de schiță: pornire → desen → publicare (intră direct în teanc) → apare ca tab nou
// pe detaliu → autorul schiței o șterge. Serial: fiecare pas depinde de starea lăsată de precedentul.
// Ținta = detaliul seedat în auth.setup.ts; userul de sesiune (e2e-tester) NU e autorul detaliului
// (e2e-author) → poate schița + valida, fără să lovească CANNOT_VALIDATE_OWN.

let cachedDetailUrl: string | null = null;
function detailUrl(): string {
  if (!cachedDetailUrl) {
    const seed = JSON.parse(
      readFileSync(path.resolve(__dirname, ".auth", "seed.json"), "utf8"),
    ) as { detailId: string; detailTitle: string };
    cachedDetailUrl = `/details/${seed.detailId}`;
  }
  return cachedDetailUrl;
}

// NU un blanket delete pe (tester, detaliu) — `sketch-draft.spec.ts` rulează în paralel (worker diferit)
// și creează propria schiță pe ACELAȘI detaliu seedat; o ștergere largă i-ar lovi schița din mers
// (race condition, nu poluare). Curățăm STRICT schița creată de acest fișier, după ID.
let sketchId: string | null = null;

async function deleteSketchById(): Promise<void> {
  if (!sketchId) return;
  const [row] = await db.select({ thumbnailUrl: sketches.thumbnailUrl }).from(sketches).where(eq(sketches.id, sketchId));
  await db.delete(sketches).where(eq(sketches.id, sketchId));
  if (row?.thumbnailUrl) await deleteBlobs([row.thumbnailUrl]);
  sketchId = null;
}

test.describe.serial("Schiță — publish & delete", () => {
  test.afterAll(deleteSketchById);

  test("Schițează peste detaliu → editor + desen → Publică → intră în teanc", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Schițează peste detaliu" }).click();
    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
    sketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1] ?? null;

    // Desen: tool-ul „pen" e selectat implicit → un drag simplu pe canvas produce un stroke.
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

    // Publicarea redirecționează la detaliu; noul tab (avatar autor sesiune) apare în strip.
    // NU getByRole cu name „E2E Tester" (substring — se potrivește și cu tab-urile altor schițe ale
    // aceluiași autor create de alte spec-uri în paralel, ex. sketch-numbering.spec.ts) — țintim STRICT
    // tab-ul acestei schițe, după ID (data-testid stabil, vezi detail-workspace.tsx).
    await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));
    await expect(page.getByTestId(`sketch-tab-${sketchId}`)).toBeVisible();
  });

  test("Tab-ul schiței → badge de teanc + ștergere de către autor", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByTestId(`sketch-tab-${sketchId}`).click();

    // Badge-ul a fost redenumit în refactorul din 2026-07-06 (panoul separat din dreapta a fost scos,
    // vezi detail-workspace.tsx) — textul curent e „schiță peste detaliu", nu „în teanc · publicată".
    await expect(page.getByText("schiță peste detaliu")).toBeVisible();

    // „Șterge schița mea" e într-un dropdown (role="menu"), deschis de „Acțiuni detaliu" — nu e vizibil direct.
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    // role="menuitem" explicit pe buton (detail-actions-menu.tsx) suprascrie rolul implicit "button".
    await page.getByRole("menuitem", { name: "Șterge schița mea" }).click();

    // După ștergere: tab-ul dispare din strip, revenim efectiv pe „Detaliul de bază".
    await expect(page.getByTestId(`sketch-tab-${sketchId}`)).toHaveCount(0);
  });
});
