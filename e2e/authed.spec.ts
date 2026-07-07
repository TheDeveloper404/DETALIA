import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { validations } from "../db/schema";
import { getSeed } from "./seed";

// E2E — fluxuri AUTHED (pornesc cu sesiunea seedată de `auth.setup.ts`, via storageState). Acoperă inima
// produsului: feed authed, validarea pe roluri (Aprob 1 click + Dezaprob cu justificare obligatorie), comentariu.
// Ținta de validare = detaliul seedat în setup; id-ul vine din `.auth/seed.json`.

// Citire LAZY: Playwright încarcă fișierele de test la descoperire (înainte de proiectul `setup`), deci
// `seed.json` nu există încă atunci. Îl citim abia la execuția testului, după ce setup-ul l-a scris.
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

test.describe("Acces authed", () => {
  test("feed-ul se încarcă (nu redirect la login)", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);
    await expect(page.getByRole("heading", { name: "Detalii în dezbatere" })).toBeVisible();
  });

  test("profilul propriu se încarcă", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText("E2E Tester").first()).toBeVisible();
  });
});

// Serial: aprobă întâi, apoi comută pe dezaprobare. „Aprob" e upsert idempotent, „Dezaprob+justificare" e
// switch determinist → ordinea garantează stări previzibile pe aceeași țintă.
test.describe.serial("Validare pe rol", () => {
  // Suita lasă poziția pe DISAPPROVE la final (testul de mai jos comută pe dezaprobare) — fără curățare,
  // rularea următoare găsește „retrage" în loc de „Aprob" (poziție veche încă activă) și pică la timeout.
  test.beforeAll(async () => {
    const { testerUserId, detailId } = getSeed();
    await db
      .delete(validations)
      .where(and(eq(validations.userId, testerUserId), eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)));
  });

  test("Aprob = 1 click → poziția devine activă", async ({ page }) => {
    await page.goto(detailUrl());
    // exact: „Aprob" e substring în „Dezaprob" → fără exact prinde ambele butoane.
    const aprob = page.getByRole("button", { name: "Aprob", exact: true });
    await aprob.click();
    // După click butoanele colapsează într-o pastilă icon-only (vezi validation-panel.tsx, 2026-07-06):
    // „Ai aprobat" nu mai e text vizibil (doar `title`), iar span-ul „Retrage" e tot în DOM (doar comprimat
    // vizual via CSS) → RĂMÂNE accessible name-ul butonului (title are prioritate mai mică). Semnalul
    // real de „aprobat" e rândul din lista de poziții, nu butonul (identic pt approve/disapprove).
    await expect(page.getByRole("button", { name: /retrage/i })).toBeVisible();
    await expect(page.getByText(/aprobă/)).toBeVisible();
  });

  test("Dezaprob cere justificare → devine comentariu argumentat", async ({ page }) => {
    await page.goto(detailUrl());
    // Poziția APPROVE din testul anterior e activă → butoanele sunt colapsate; retragem întâi.
    // Butoanele reapar OPTIMIST (înainte de răspunsul serverului) → așteptăm round-trip-ul acțiunii
    // de retract (POST-ul server action), altfel dezaprobarea poate ajunge pe server ÎNAINTEA
    // retract-ului și e ștearsă de el (test flaky + poziție pierdută).
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
      page.getByRole("button", { name: /retrage/ }).click(),
    ]);
    const dezaprob = page.getByRole("button", { name: "Dezaprob", exact: true });
    await dezaprob.click();
    // Pe DETAIL, Dezaprob deschide întâi alegerea binară (text/schiță) — vezi validation-panel.tsx.
    await page.getByRole("button", { name: "Scrie o justificare" }).click();

    const justif = `E2E justificare ${Date.now()}`;
    await page.getByPlaceholder(/Explică de ce dezaprobi/).fill(justif);
    await page.getByRole("button", { name: "Trimite dezaprobarea" }).click();

    await expect(page.getByText(/Ai dezaprobat acest detaliu/)).toBeVisible();
    // Justificarea devine comentariu vizibil în dezbatere (fără „dezaprobare mută").
    await expect(page.getByText(justif)).toBeVisible();
  });
});

test("comentariu pe detaliu apare în dezbatere", async ({ page }) => {
  await page.goto(detailUrl());
  const body = `E2E comentariu ${Date.now()}`;
  await page.getByPlaceholder(/Adaugă la dezbatere/).fill(body);
  await page.getByRole("button", { name: "Comentează" }).click();
  await expect(page.getByText(body)).toBeVisible();
});
