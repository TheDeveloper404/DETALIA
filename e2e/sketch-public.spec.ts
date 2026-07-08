import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { sketches } from "../db/schema";
import { getSeed } from "./seed";

// E2E — /s/[id]: teaser PUBLIC (fără cont) al unei schițe. Anonim, fără storageState. Anti-enumerare:
// draft/inexistent/id invalid → 404 uniform, fără să distingem cauza.

test("schiță publicată → randează teaser cu autor + CTA de signup", async ({ page }) => {
  const { detailId, detailTitle, testerUserId } = getSeed();

  const [row] = await db
    .insert(sketches)
    .values({ detailId, authorId: testerUserId, status: "PUBLISHED", strokesJson: [] })
    .returning({ id: sketches.id });

  try {
    await page.goto(`/s/${row.id}`);
    await expect(page).toHaveTitle(new RegExp(detailTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.getByRole("heading", { name: `Schiță peste „${detailTitle}”` })).toBeVisible();
    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByRole("link", { name: "Creează cont gratuit" })).toBeVisible();
  } finally {
    await db.delete(sketches).where(eq(sketches.id, row.id));
  }
});

test("schiță DRAFT (nepublicată) → 404, nu leak de conținut", async ({ page }) => {
  const { detailId, testerUserId } = getSeed();

  const [row] = await db
    .insert(sketches)
    .values({ detailId, authorId: testerUserId, status: "DRAFT", strokesJson: [] })
    .returning({ id: sketches.id });

  try {
    await page.goto(`/s/${row.id}`);
    await expect(page.getByText("404")).toBeVisible();
  } finally {
    await db.delete(sketches).where(eq(sketches.id, row.id));
  }
});

test("id inexistent → 404", async ({ page }) => {
  await page.goto("/s/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("404")).toBeVisible();
});

test("id malformat (nu UUID) → 404, nu 500", async ({ page }) => {
  await page.goto("/s/not-a-uuid");
  await expect(page.getByText("404")).toBeVisible();
});
