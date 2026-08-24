import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { validations } from "../db/schema";
import { getSeed } from "./seed";

// Nume/poză → link spre profil, din locuri altele decât cardul de feed (deja acoperit de alte teste):
// lista de poziții din panoul de validare. Fișier separat de authed.spec.ts (nu-i deranjează
// `describe.serial` „Validare pe rol" de-acolo — stare proprie, curățată la final).

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

test.describe("Nume/poză din panoul de validare → link spre profil", () => {
  // Detaliul seedat e PARTAJAT cu authed.spec.ts, care lasă intenționat o poziție DISAPPROVE la finalul
  // suitei „Validare pe rol" (vezi authed.spec.ts:66-67) — fără curățare ÎNAINTE, butonul „Aprobă" ar
  // rămâne dezactivat (disabled={myPos !== null && !approved}) dacă acest fișier rulează după acela.
  test.beforeEach(async () => {
    const { testerUserId, detailId } = getSeed();
    await db
      .delete(validations)
      .where(
        and(eq(validations.userId, testerUserId), eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)),
      );
  });

  test.afterEach(async () => {
    const { testerUserId, detailId } = getSeed();
    await db
      .delete(validations)
      .where(
        and(eq(validations.userId, testerUserId), eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)),
      );
  });

  test("clic pe numele din rândul de poziție → /profile/<id>-ul userului respectiv", async ({ page }) => {
    const { testerUserId } = getSeed();

    await page.goto(detailUrl());
    await page.getByRole("button", { name: "Aprobă", exact: true }).click();

    // Rândul de poziție (nume + rol) din lista „Pozițiile celorlalți" — vezi validation-panel.tsx —
    // conține acum un link explicit spre /profile/<userId>, căutat direct după href.
    const profileLink = page.locator(`a[href="/profile/${testerUserId}"]`);
    await expect(profileLink).toBeVisible();
    await profileLink.click();

    await expect(page).toHaveURL(new RegExp(`/profile/${testerUserId}$`));
  });
});
