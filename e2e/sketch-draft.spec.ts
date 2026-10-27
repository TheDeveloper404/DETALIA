import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { details, sketches } from "../db/schema";

// Ciclul de CIORNĂ (netestat până acum — sketch.spec.ts acoperă doar publish direct, nu save→resume→delete):
// pornește schița → desenează → „Salvează ciornă" (rămâne DRAFT) → apare în „Ciornele mele" → „Continuă"
// o reia cu stroke-urile păstrate → șters din listă. Serial: fiecare pas depinde de starea precedentă.

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

function drawStroke(canvasBox: { x: number; y: number; width: number; height: number }, page: import("@playwright/test").Page) {
  const x = canvasBox.x + canvasBox.width / 2;
  const y = canvasBox.y + canvasBox.height / 2;
  return (async () => {
    await page.mouse.move(x - 40, y - 40);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 5 });
    await page.mouse.move(x + 40, y + 40, { steps: 5 });
    await page.mouse.up();
  })();
}

test.describe.serial("Schiță — draft: salvează, reia, șterge", () => {
  let sketchId: string | null = null;
  let isolatedDetailId: string;
  let savedStrokes: unknown;

  test.beforeAll(async () => {
    // Refolosirea ciornei este comportamentul cerut; spec-urile paralele au nevoie de detalii distincte.
    const sourceId = detailUrl().split("/").at(-1)!;
    const [source] = await db.select().from(details).where(eq(details.id, sourceId));
    if (!source) throw new Error("Lipseste detaliul seed pentru ciorne");
    const [isolated] = await db.insert(details).values({ authorId: source.authorId, title: "E2E reluare ciorna", imageUrl: source.imageUrl, status: "PUBLISHED" }).returning({ id: details.id });
    isolatedDetailId = isolated.id;
  });

  test.afterAll(async () => {
    // Curățare de siguranță dacă vreun pas eșuează înainte de ștergerea din UI.
    if (sketchId) await db.delete(sketches).where(eq(sketches.id, sketchId));
    if (isolatedDetailId) await db.delete(details).where(eq(details.id, isolatedDetailId));
  });

  test("pornește schița, desenează, Salvează ciornă → rămâne DRAFT, redirect la Ciornele mele", async ({ page }) => {
    await page.goto(`/details/${isolatedDetailId}`);
    await page.getByRole("button", { name: "Schițează" }).click();
    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
    sketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1] ?? null;
    expect(sketchId).toBeTruthy();

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas fără bounding box");
    await drawStroke(box, page);

    const saveDraftBtn = page.getByRole("button", { name: "Salvează ciornă" });
    await expect(saveDraftBtn).toBeEnabled();
    await saveDraftBtn.click();

    // Redirect la „Ciornele mele" (nu la detaliu) — decizie discoverability 2026-07-18.
    await expect(page).toHaveURL("/sketches/drafts");

    const [row] = await db.select({ status: sketches.status, strokes: sketches.strokesJson }).from(sketches).where(eq(sketches.id, sketchId!));
    expect(row?.status).toBe("DRAFT");
    savedStrokes = row.strokes;
  });

  // Regula aprobata: "daca am desenat ceva si am salvat in ciorna, trebuie si cand intru iar sa fie tot acolo."
  test("ciorna se reia din lista si din Schiteaza cu acelasi desen", async ({ page }) => {
    await page.goto("/sketches/drafts");
    // Cardul are 3 linkuri cu același href (imagine, titlu, „Continuă") → .first(), altfel strict mode.
    const draftLink = page.locator(`a[href="/sketches/${sketchId}/edit"]`).first();
    await expect(draftLink).toBeVisible();
    await draftLink.click();

    await expect(page).toHaveURL(`/sketches/${sketchId}/edit`);
    // Stroke-ul salvat anterior trebuie să fi fost reîncărcat — butonul de publish e activ (count > 0).
    await expect(page.getByRole("button", { name: /Publică schița/ })).toBeEnabled();
    // Salvarea reciteste canvasRef.getStrokes(), nu doar contorul initial din props.
    await page.getByRole("button", { name: "Salvează ciornă" }).click();
    await expect(page).toHaveURL("/sketches/drafts");
    const [savedAgain] = await db.select({ strokes: sketches.strokesJson }).from(sketches).where(eq(sketches.id, sketchId!));
    expect(savedAgain.strokes).toEqual(savedStrokes);

    await page.goto(`/details/${isolatedDetailId}`);
    await page.getByRole("button", { name: "Schițează" }).click();
    await expect(page).toHaveURL(`/sketches/${sketchId}/edit`);
    await expect(page.getByRole("button", { name: /Publică schița/ })).toBeEnabled();
    await page.getByRole("button", { name: "Salvează ciornă" }).click();
    await expect(page).toHaveURL("/sketches/drafts");
    const [resumed] = await db.select({ strokes: sketches.strokesJson }).from(sketches).where(eq(sketches.id, sketchId!));
    expect(resumed.strokes).toEqual(savedStrokes);
    expect(await db.select({ id: sketches.id }).from(sketches).where(eq(sketches.detailId, isolatedDetailId))).toHaveLength(1);
  });

  test("ciorna se șterge din listă", async ({ page }) => {
    await page.goto("/sketches/drafts");
    const row = page.locator("article", { has: page.locator(`a[href="/sketches/${sketchId}/edit"]`) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Șterge ciorna" }).click();

    await expect(page.locator(`a[href="/sketches/${sketchId}/edit"]`)).toHaveCount(0);

    // UI-ul e OPTIMIST (dispare instant) — server action-ul (deleteDraftAction) poate încă rula în
    // fundal când ajungem aici. Poll pe DB, nu o singură citire imediată (rasă reală, nu ipotetică —
    // a picat exact așa la prima rulare reală).
    await expect(async () => {
      const remaining = await db.select().from(sketches).where(eq(sketches.id, sketchId!));
      expect(remaining).toHaveLength(0);
    }).toPass({ timeout: 10_000 });
    sketchId = null; // deja șters, afterAll nu mai trebuie să facă nimic
  });
});
