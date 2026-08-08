import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { sketches } from "../db/schema";
import { deleteBlobs } from "../lib/storage";

// E2E — STACK DE FOI (2026-08-08, Faza A): „Schițează peste" nu mai pornește mereu de la detaliul gol.
// Apăsat dintr-un tab de schiță, îngheață ce e aprins pe ecran (bază + foile bifate + schița activă) și
// îl folosește ca fundal al foii noi. La vizualizare apar bife libere, una per foaie din teanc.
//
// Serial: fiecare pas depinde de starea lăsată de precedentul (foaia 2 se desenează PESTE foaia 1).
// Ținta = detaliul seedat în auth.setup.ts; userul de sesiune (e2e-tester) NU e autorul detaliului,
// deci schițele lui intră în teanc, nu ca adnotări.

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

// Curățare STRICT după ID-urile create aici — alte spec-uri (sketch.spec.ts, sketch-numbering.spec.ts)
// rulează în paralel pe ACELAȘI detaliu seedat; un delete larg le-ar lovi schițele din mers.
const createdIds: string[] = [];

async function cleanup(): Promise<void> {
  if (createdIds.length === 0) return;
  const rows = await db
    .select({ thumbnailUrl: sketches.thumbnailUrl })
    .from(sketches)
    .where(inArray(sketches.id, createdIds));
  await db.delete(sketches).where(inArray(sketches.id, createdIds));
  const thumbs = rows.map((r) => r.thumbnailUrl).filter((u): u is string => !!u);
  if (thumbs.length > 0) await deleteBlobs(thumbs);
  createdIds.length = 0;
}

// Un drag simplu pe canvas → un stroke (tool-ul „pen" e selectat implicit). Offset-ul permite desene
// în zone diferite, ca cele două foi să nu se suprapună perfect vizual.
async function drawOnCanvas(page: import("@playwright/test").Page, offset: number): Promise<void> {
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas fără bounding box");
  const x = box.x + box.width / 2 + offset;
  const y = box.y + box.height / 2 + offset;
  await page.mouse.move(x - 40, y - 40);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.move(x + 40, y + 40, { steps: 5 });
  await page.mouse.up();
}

test.describe.serial("Schiță — stack de foi", () => {
  let firstSketchId: string;
  let secondSketchId: string;

  test.afterAll(cleanup);

  test("foaia 1: pornită de pe detaliul gol → fără teanc de foi sub ea", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Schițează peste detaliu" }).click();
    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
    firstSketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1] ?? "";
    expect(firstSketchId).not.toBe("");
    createdIds.push(firstSketchId);

    await drawOnCanvas(page, -60);
    await page.getByRole("button", { name: /Publică schița/ }).click();

    await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));
    await page.getByTestId(`sketch-tab-${firstSketchId}`).click();

    // Pornită de pe detaliul gol → nu are foi în fundal, deci secțiunea de bife nu apare deloc.
    await expect(page.getByText("Foi în teanc")).toHaveCount(0);

    // Butonul își schimbă textul pe tab de schiță: continuă dezbaterea, nu pornește de la zero.
    await expect(page.getByRole("button", { name: "Schițează peste ce vezi acum" })).toBeVisible();
  });

  test("foaia 2: desenată peste foaia 1 → rețeta se persistă cu foaia 1 ca fundal", async ({
    page,
  }) => {
    await page.goto(`${detailUrl()}?sketch=${firstSketchId}`);
    await page.getByRole("button", { name: "Schițează peste ce vezi acum" }).click();

    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
    secondSketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1] ?? "";
    expect(secondSketchId).not.toBe("");
    createdIds.push(secondSketchId);

    await drawOnCanvas(page, 60);
    await page.getByRole("button", { name: /Publică schița/ }).click();
    await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));

    // Dovada în DB, nu doar în UI: rețeta conține EXACT foaia 1 (nu detaliul, nu altceva).
    const [row] = await db
      .select({ baseSketchIds: sketches.baseSketchIds, lockedAt: sketches.lockedAt })
      .from(sketches)
      .where(eq(sketches.id, secondSketchId));
    expect(row.baseSketchIds).toEqual([firstSketchId]);

    // Foaia 1 a devenit BLOCATĂ prin publicarea foii 2 — cineva a construit peste ea.
    const [base] = await db
      .select({ lockedAt: sketches.lockedAt })
      .from(sketches)
      .where(eq(sketches.id, firstSketchId));
    expect(base.lockedAt).not.toBeNull();
  });

  test("vizualizare: bifă per foaie din teanc, stingerea e liberă", async ({ page }) => {
    await page.goto(`${detailUrl()}?sketch=${secondSketchId}`);

    await expect(page.getByText("Foi în teanc")).toBeVisible();
    // Detaliul de bază apare în listă, dar fără bifă acționabilă — e mereu aprins.
    await expect(page.getByText("Detaliul de bază")).toBeVisible();

    // Bifa foii 1: pornește APRINSĂ (exact ce vedea autorul când a desenat).
    const layerToggle = page.getByTestId(`stack-layer-${firstSketchId}`);
    await expect(layerToggle).toBeVisible();
    await expect(layerToggle).toHaveAttribute("aria-pressed", "true");

    // Stingere → rămâne pe pagină, doar starea se schimbă (randarea scoate foaia din compunere).
    await layerToggle.click();
    await expect(layerToggle).toHaveAttribute("aria-pressed", "false");

    // Reaprindere → liberă, în orice ordine (bifele NU sunt ierarhice).
    await layerToggle.click();
    await expect(layerToggle).toHaveAttribute("aria-pressed", "true");
  });

  // FAZA B — o foaie pe care alții au construit nu mai dispare complet: se retrage doar identitatea.
  // Testul de după (bifele) rămâne valid: ștergerea parțială schimbă eticheta foii, nu prezența bifei.
  test("ștergere pe foaie blocată → desenul rămâne, identitatea dispare", async ({ page }) => {
    await page.goto(`${detailUrl()}?sketch=${firstSketchId}`);

    // Eticheta din meniu spune deja că nu e o ștergere obișnuită.
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    const retractItem = page.getByRole("menuitem", { name: "Retrage-mă din schiță" });
    await expect(retractItem).toBeVisible();
    await retractItem.click();

    // Dialogul explică DINAINTE ce se întâmplă, ca userul să nu apese așteptând dispariția schiței.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/desenul rămâne/i)).toBeVisible();
    // Buton dedicat pe ramura de retragere (confirmLabel="Retrage-mă") — NU "Șterge", ca să nu
    // sugereze că desenul dispare.
    await page.getByRole("button", { name: "Retrage-mă" }).click();

    // Tab-ul NU dispare — desenul e parte din dezbaterea pe care foaia 2 a continuat-o.
    await expect(page.getByTestId(`sketch-tab-${firstSketchId}`)).toBeVisible();

    // Dovada în DB: flagul e setat, dar desenul și rândul sunt intacte.
    const [row] = await db
      .select({
        authorRemoved: sketches.authorRemoved,
        strokesJson: sketches.strokesJson,
        roleSnapshot: sketches.roleSnapshot,
      })
      .from(sketches)
      .where(eq(sketches.id, firstSketchId));
    expect(row.authorRemoved).toBe(true);
    expect(row.strokesJson).not.toBeNull();
    // Rolul înghețat la publicare rămâne — e ce se afișează lângă „Autor șters".
    expect(row.roleSnapshot).not.toBeNull();

    // În teancul foii 2, foaia 1 apare acum ca „Autor șters", nu cu numele real.
    await page.goto(`${detailUrl()}?sketch=${secondSketchId}`);
    await expect(page.getByTestId(`stack-layer-${firstSketchId}`)).toContainText("Autor șters");
  });

  test("starea bifelor NU se persistă — la reintrare teancul e din nou întreg", async ({ page }) => {
    await page.goto(`${detailUrl()}?sketch=${secondSketchId}`);
    const layerToggle = page.getByTestId(`stack-layer-${firstSketchId}`);
    await layerToggle.click();
    await expect(layerToggle).toHaveAttribute("aria-pressed", "false");

    // Comutare pe alt tab și înapoi: starea de vizualizare se resetează (decizie de produs — la fiecare
    // deschidere vezi stack-ul întreg, nu o preferință veche).
    await page.getByTestId(`sketch-tab-${firstSketchId}`).click();
    await page.getByTestId(`sketch-tab-${secondSketchId}`).click();

    await expect(page.getByTestId(`stack-layer-${firstSketchId}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
