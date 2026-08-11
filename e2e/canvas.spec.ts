import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { canvasItems, canvases } from "../db/schema";

// Planșă (Canvas) — CRUD prin UI, netestat până acum. NU testăm motorul de desen/pan/zoom (engine propriu,
// interacții fragile de reprodus determinist) — doar fluxul de produs: creare/redenumire/duplicare/ștergere
// planșă + „Trimite în Planșă" dintr-un detaliu. IDOR (planșa e strict privată) e acoperit separat, la nivel
// de service, în security.spec.ts.

let cachedDetailId: string | null = null;
function detailId(): string {
  if (!cachedDetailId) {
    const seed = JSON.parse(
      readFileSync(path.resolve(__dirname, ".auth", "seed.json"), "utf8"),
    ) as { detailId: string };
    cachedDetailId = seed.detailId;
  }
  return cachedDetailId;
}
function detailUrl(): string {
  return `/details/${detailId()}`;
}

test.describe.serial("Planșă — creare, redenumire, duplicare, ștergere", () => {
  const name = `E2E planșă ${Date.now()}`;
  const renamedName = `${name} (redenumită)`;
  let canvasId: string | null = null;
  let duplicateId: string | null = null;

  test.afterAll(async () => {
    if (canvasId) await db.delete(canvases).where(eq(canvases.id, canvasId));
    if (duplicateId) await db.delete(canvases).where(eq(canvases.id, duplicateId));
  });

  test("Planșă nouă → creează → deschide editorul", async ({ page }) => {
    await page.goto("/canvases");
    await page.getByRole("button", { name: "Planșă nouă" }).click();
    await page.getByPlaceholder(/Nume planșă/).fill(name);
    await page.getByRole("button", { name: "Creează" }).click();

    await expect(page).toHaveURL(/\/canvases\/[0-9a-f-]+\/edit/);
    canvasId = page.url().match(/\/canvases\/([0-9a-f-]+)\/edit/)?.[1] ?? null;
    expect(canvasId).toBeTruthy();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  test("redenumește planșa din listă", async ({ page }) => {
    await page.goto("/canvases");

    const card = page.locator(".group", { hasText: name });
    await card.getByRole("button").last().click(); // kebab „⋮"
    await page.getByRole("button", { name: "Redenumește" }).click();
    // NU `card.getByRole("textbox")` — la intrarea în renaming, textul cardului (folosit de `hasText`
    // în definiția lui `card`) e înlocuit de un <input>, al cărui value NU intră în textContent → `card`
    // nu se mai potrivește. Fix: input-ul de redenumire e singurul textbox vizibil pe pagină în acest pas.
    await page.getByRole("textbox").fill(renamedName);
    await page.keyboard.press("Enter");

    await expect(page.getByText(renamedName, { exact: true })).toBeVisible();
  });

  test("duplică planșa → apare un card nou", async ({ page }) => {
    await page.goto("/canvases");
    const card = page.locator(".group", { hasText: renamedName });
    await card.getByRole("button").last().click();
    await page.getByRole("button", { name: "Duplică" }).click();

    await expect(page.getByText(`${renamedName} (copie)`, { exact: true })).toBeVisible({ timeout: 10_000 });
    const rows = await db.select({ id: canvases.id, name: canvases.name }).from(canvases);
    duplicateId = rows.find((r) => r.name === `${renamedName} (copie)`)?.id ?? null;
    expect(duplicateId).toBeTruthy();
  });

  test("șterge planșa originală și duplicatul", async ({ page }) => {
    await page.goto("/canvases");

    for (const target of [renamedName, `${renamedName} (copie)`]) {
      const card = page.locator(".group", { hasText: target });
      await card.getByRole("button").last().click();
      await card.getByRole("button", { name: "Șterge" }).click();
      await expect(page.getByText(target, { exact: true })).toHaveCount(0);
    }
    canvasId = null;
    duplicateId = null;
  });
});

test("Trimite în Planșă: creează + adaugă detaliul curent dintr-un detaliu", async ({ page }) => {
  const name = `E2E send-to-canvas ${Date.now()}`;
  let canvasId: string | null = null;

  try {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    await page.getByRole("menuitem", { name: "Trimite în Planșă" }).click();

    await expect(page.getByRole("dialog", { name: "Trimite în Planșă" })).toBeVisible();
    await page.getByRole("button", { name: "Creează planșă nouă" }).click();
    await page.getByPlaceholder("Nume planșă nouă").fill(name);
    await page.getByRole("button", { name: "Creează & adaugă" }).click();

    const openLink = page.getByRole("link", { name: "Deschide planșa →" });
    await expect(openLink).toBeVisible();
    await openLink.click();

    await expect(page).toHaveURL(/\/canvases\/[0-9a-f-]+\/edit/);
    canvasId = page.url().match(/\/canvases\/([0-9a-f-]+)\/edit/)?.[1] ?? null;
    expect(canvasId).toBeTruthy();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  } finally {
    if (canvasId) await db.delete(canvases).where(eq(canvases.id, canvasId));
  }
});

test("Elimină detaliu de pe planșă: distinct de ștergerea planșei întregi — indexul se golește, planșa rămâne", async ({
  page,
}) => {
  const name = `E2E remove-item ${Date.now()}`;
  let canvasId: string | null = null;

  try {
    // Setup identic cu "Trimite în Planșă" de mai sus — un singur item, primul din cascadă (poziție
    // cunoscută: x=0.08, y=0.08, width=0.28, height≈0.373 — vezi buildInitialSnapshot, plansa-canvas.tsx).
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    await page.getByRole("menuitem", { name: "Trimite în Planșă" }).click();
    await expect(page.getByRole("dialog", { name: "Trimite în Planșă" })).toBeVisible();
    await page.getByRole("button", { name: "Creează planșă nouă" }).click();
    await page.getByPlaceholder("Nume planșă nouă").fill(name);
    await page.getByRole("button", { name: "Creează & adaugă" }).click();
    await page.getByRole("link", { name: "Deschide planșa →" }).click();

    await expect(page).toHaveURL(/\/canvases\/[0-9a-f-]+\/edit/);
    canvasId = page.url().match(/\/canvases\/([0-9a-f-]+)\/edit/)?.[1] ?? null;
    expect(canvasId).toBeTruthy();

    // Dovadă în DB, ÎNAINTE de eliminare: item-ul e indexat.
    await expect
      .poll(async () => {
        const rows = await db
          .select({ id: canvasItems.id })
          .from(canvasItems)
          .where(eq(canvasItems.canvasId, canvasId!));
        return rows.length;
      })
      .toBe(1);

    // Selectează item-ul: click în centrul lui (mod implicit "select"). Coordonate normalizate → pixeli,
    // ca la `drawOnCanvas` din e2e/sketch-stack.spec.ts (canvas.width/height == boundingBox CSS, fără DPR).
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas fără bounding box");
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.27);

    const removeBtn = page.getByRole("button", { name: "Elimină de pe planșă" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Indexul se golește (server action, verificat direct în DB — clientul șterge din document oricum).
    await expect
      .poll(async () => {
        const rows = await db
          .select({ id: canvasItems.id })
          .from(canvasItems)
          .where(eq(canvasItems.canvasId, canvasId!));
        return rows.length;
      })
      .toBe(0);

    // Planșa însăși NU a dispărut — distinct de "șterge planșa" (testat mai sus).
    const [row] = await db.select({ id: canvases.id }).from(canvases).where(eq(canvases.id, canvasId!));
    expect(row).toBeTruthy();
  } finally {
    if (canvasId) await db.delete(canvases).where(eq(canvases.id, canvasId));
  }
});
