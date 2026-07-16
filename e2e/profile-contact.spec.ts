import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { getSeed } from "./seed";

// Telefon/email opțional pe profil, vizibilitate opt-in per câmp (2026-07-16, cerere Edi). Proprietarul
// vede ÎNTOTDEAUNA datele lui; alt user vede DOAR dacă flagul de vizibilitate e explicit true.

test.describe.serial("Profil — telefon/email opțional, vizibilitate opt-in", () => {
  test.afterAll(async () => {
    const { testerUserId, authorUserId } = getSeed();
    // Curăță ambii useri — testerul (editat direct din formular) + authorul (setat direct din DB).
    await db.update(users).set({ phone: null, phoneVisible: false, emailVisible: false }).where(eq(users.id, testerUserId));
    await db.update(users).set({ phone: null, phoneVisible: false, emailVisible: false }).where(eq(users.id, authorUserId));
  });

  test("proprietarul completează telefon + bifează vizibil → apare pe propriul profil public", async ({ page }) => {
    const { testerUserId } = getSeed();
    const phone = `07${Date.now()}`.slice(0, 12);

    await page.goto("/profile/edit");
    await page.getByLabel(/^Telefon/).fill(phone);
    await page.getByLabel("Vizibil altor useri").first().check();
    await page.getByRole("button", { name: "Salvează profilul" }).click();
    await expect(page.getByRole("status")).toHaveText("Profilul a fost actualizat.");

    await page.goto(`/profile/${testerUserId}`);
    await expect(page.getByRole("link", { name: new RegExp(phone) })).toBeVisible();
  });

  test("vizitator NU vede telefonul altui user dacă acesta NU l-a făcut vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    await db
      .update(users)
      .set({ phone: "0722999888", phoneVisible: false })
      .where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: /0722999888/ })).toHaveCount(0);
  });

  test("vizitator VEDE telefonul altui user dacă acesta l-a făcut explicit vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    await db
      .update(users)
      .set({ phone: "0722999888", phoneVisible: true })
      .where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: /0722999888/ })).toBeVisible();
  });

  test("vizitator NU vede emailul altui user dacă acesta NU l-a făcut vizibil (implicit privat)", async ({
    page,
  }) => {
    const { authorUserId } = getSeed();
    const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, authorUserId));
    await db.update(users).set({ emailVisible: false }).where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: new RegExp(author.email) })).toHaveCount(0);
  });

  test("vizitator VEDE emailul altui user dacă acesta l-a făcut explicit vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, authorUserId));
    await db.update(users).set({ emailVisible: true }).where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: new RegExp(author.email) })).toBeVisible();
  });
});
