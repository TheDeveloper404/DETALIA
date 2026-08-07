import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { comments, detailCategories, details, validations } from "../db/schema";
import { getSeed } from "./seed";

// E2E — iconița „Aprob" din feed (2026-08-07, pattern LinkedIn): eticheta text „N validări" a dispărut,
// count-ul stă acum lângă iconița thumbs-up (components/feed-validation-actions.tsx), se ajustează
// optimist (+1/-1) la click, fără reload. Vezi și testul unitar computeOptimisticValidationCount.
//
// Detaliu propriu (nu cel seedat comun) — evită coliziuni cu alte suite care rulează în paralel pe
// detaliul comun și evită idempotența „Aprob" (poziție deja activă → butonul ar fi deja „Retrage").
test.describe.serial("Feed — icon Aprob cu count inline, fără eticheta text „validări”", () => {
  let detailId = "";
  const title = `E2E feed-validare ${Date.now()}`;

  test.beforeAll(async () => {
    const { testerUserId, categoryId } = getSeed();
    const [row] = await db
      .insert(details)
      .values({
        title,
        authorId: testerUserId,
        imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
        status: "PUBLISHED",
      })
      .returning({ id: details.id });
    await db.insert(detailCategories).values({ detailId: row.id, categoryId });
    detailId = row.id;
  });

  test.afterAll(async () => {
    if (!detailId) return;
    await db.delete(validations).where(and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)));
    await db.delete(comments).where(and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId)));
    await db.delete(details).where(eq(details.id, detailId));
  });

  test("card-ul din feed nu mai are eticheta text „validări”", async ({ page }) => {
    await page.goto(`/feed?q=${encodeURIComponent(title)}`);
    const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });
    await expect(card).toBeVisible();
    await expect(card.getByText(/validări$/)).toHaveCount(0);
  });

  test("hover → Aprob → count crește la 1 lângă iconiță, fără reload", async ({ page }) => {
    await page.goto(`/feed?q=${encodeURIComponent(title)}`);
    const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });

    const trigger = card.getByTitle("Validează");
    await expect(trigger).toContainText("0");
    await trigger.hover();

    await card.getByRole("menuitem", { name: "Aprob", exact: true }).click();

    const retractBtn = card.getByTitle(/Ai aprobat/);
    await expect(retractBtn).toContainText("1");
    await expect(card.getByTitle("Validează")).toHaveCount(0);

    const selectRow = () =>
      db
        .select({ position: validations.position })
        .from(validations)
        .where(and(eq(validations.userId, getSeed().testerUserId), eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)));
    await expect.poll(async () => (await selectRow()).length, { timeout: 5_000 }).toBe(1);
  });

  test("click pe Retrage → count revine la 0", async ({ page }) => {
    await page.goto(`/feed?q=${encodeURIComponent(title)}`);
    const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });

    const retractBtn = card.getByTitle(/Ai aprobat/);
    await expect(retractBtn).toContainText("1");
    await retractBtn.click();

    const trigger = card.getByTitle("Validează");
    await expect(trigger).toContainText("0");

    const selectRow = () =>
      db
        .select({ position: validations.position })
        .from(validations)
        .where(and(eq(validations.userId, getSeed().testerUserId), eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)));
    await expect.poll(async () => (await selectRow()).length, { timeout: 5_000 }).toBe(0);
  });
});
