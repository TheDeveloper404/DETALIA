import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

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

test.describe.serial("Schiță — publish & delete", () => {
  test("Schițează peste detaliu → editor + desen → Publică → intră în teanc", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Schițează peste detaliu" }).click();
    await expect(page).toHaveURL(/\/sketches\/.+\/edit/);

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
    await expect(page).toHaveURL(new RegExp(`${detailUrl()}$`));
    await expect(page.getByRole("button", { name: "E2E Tester" })).toBeVisible();
  });

  test("Tab-ul schiței → badge de teanc + ștergere de către autor", async ({ page }) => {
    await page.goto(detailUrl());
    await page.getByRole("button", { name: "E2E Tester" }).click();

    await expect(page.getByText("în teanc · publicată")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Șterge schița mea" }).click();

    // După ștergere: tab-ul dispare din strip, revenim efectiv pe „Detaliul de bază".
    await expect(page.getByRole("button", { name: "E2E Tester" })).toHaveCount(0);
  });
});
