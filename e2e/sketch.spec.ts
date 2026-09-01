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

let cachedSeed: { detailId: string; detailTitle: string } | null = null;
function seedData(): { detailId: string; detailTitle: string } {
  if (!cachedSeed) {
    cachedSeed = JSON.parse(
      readFileSync(path.resolve(__dirname, ".auth", "seed.json"), "utf8"),
    ) as { detailId: string; detailTitle: string };
  }
  return cachedSeed;
}
function detailUrl(): string {
  return `/details/${seedData().detailId}`;
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

  test("Schițează → editor + desen → Publică → intră în teanc", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Schițează" }).click();
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
    // role="menuitem" explicit pe buton (detail-actions-menu.tsx) suprascrie rolul implicit "button".
    await page.getByRole("menuitem", { name: "Șterge schița mea" }).click();

    // Confirmare stil platformă (2026-07-16) — NU mai e window.confirm nativ, e un dialog propriu.
    // „Anulează" ÎNTÂI: dialogul se închide, schița NU se șterge (verificăm înainte de confirmarea reală).
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Anulează" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId(`sketch-tab-${sketchId}`)).toBeVisible();

    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    await page.getByRole("menuitem", { name: "Șterge schița mea" }).click();
    await page.getByRole("button", { name: "Șterge" }).click();

    // După ștergere: tab-ul dispare din strip, revenim efectiv pe „Detaliul de bază".
    await expect(page.getByTestId(`sketch-tab-${sketchId}`)).toHaveCount(0);
  });
});

// ── Pasteboard (2026-09-01): desen ÎN AFARA imaginii ─────────────────────────────────────────────
// O schiță poate avea trasee dincolo de marginea imaginii-mamă (bandă [-1, 2] pe fiecare axă). Pe
// pagina publicată, când există așa ceva, imaginea se micșorează ca să încapă tot desenul și viewer-ul
// devine zoom-abil (`PasteboardSketchViewer`, `data-testid="pasteboard-viewer"`); `<Image>`-ul de bază
// randat de părinte dispare pentru acel tab (altfel s-ar suprapune două imagini la scări diferite).
let pbSketchId: string | null = null;

test.describe.serial("Schiță — pasteboard (desen în afara imaginii)", () => {
  test.afterAll(async () => {
    if (!pbSketchId) return;
    const [row] = await db
      .select({ thumbnailUrl: sketches.thumbnailUrl })
      .from(sketches)
      .where(eq(sketches.id, pbSketchId));
    await db.delete(sketches).where(eq(sketches.id, pbSketchId));
    if (row?.thumbnailUrl) await deleteBlobs([row.thumbnailUrl]);
    pbSketchId = null;
  });

  test("desen dincolo de marginea foii → Publică → viewer pasteboard pe detaliu", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Schițează" }).click();
    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);
    pbSketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1] ?? null;

    // Editorul acoperă mereu banda [-1,2]², dar la zoom 100% se vede doar foaia (treimea din
    // mijloc). Ca să desenăm în pasteboard, dăm întâi zoom-out (userul face la fel — nimic automat).
    const zoomOut = page.getByRole("button", { name: "Micșorează" });
    for (let i = 0; i < 5; i++) await zoomOut.click();

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas fără bounding box");
    // La zoom-out, canvas-ul (3× foaia) e vizibil aproape întreg: mijlocul = foaia, marginile =
    // pasteboard. Tragem din centru (foaie) spre colțul dreapta-jos al canvas-ului (pasteboard) →
    // traseul are puncte cu x/y > 1.
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 6 });
    await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.9, { steps: 6 });
    await page.mouse.up();

    const publishBtn = page.getByRole("button", { name: /Publică schița/ });
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));
    await page.getByTestId(`sketch-tab-${pbSketchId}`).click();

    // Viewer-ul pasteboard e montat, iar `<Image>`-ul de bază (alt = titlul detaliului) NU mai e
    // randat pe acest tab (showBaseImage=false).
    await expect(page.getByTestId("pasteboard-viewer")).toBeVisible();
    await expect(page.getByRole("img", { name: seedData().detailTitle })).toHaveCount(0);

    // Zoom pe card: dublu-click resetează (nu crapă, viewer-ul rămâne).
    await page.getByTestId("pasteboard-viewer").locator("canvas").dblclick();
    await expect(page.getByTestId("pasteboard-viewer")).toBeVisible();
  });
});
