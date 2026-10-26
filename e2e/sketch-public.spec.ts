import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { db } from "../db";
import { sketches } from "../db/schema";
import { getSeed } from "./seed";
import { blobStoreOptions, deleteOwnBlob } from "../lib/blob-store";

// E2E — /s/[id]: teaser PUBLIC (fără cont) al unei schițe. Anonim, fără storageState. Anti-enumerare:
// draft/inexistent/id invalid → 404 uniform, fără să distingem cauza.

// "Pagină PUBLICĂ (fără cont) pt o schiță anume — teaser READ-ONLY" (app/s/[id]/page.tsx).
test("teaser anonim: thumbnail Blob privat incarcat prin proxy-ul public si handler", async ({
  page,
}) => {
  const { detailId, testerUserId } = getSeed();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const uploaded = await put(`u/${testerUserId}/sketches/${crypto.randomUUID()}.png`, png, {
    access: "private",
    ...blobStoreOptions("private"),
    contentType: "image/png",
    addRandomSuffix: false,
  });
  let sketchId: string | undefined;
  try {
    const [row] = await db
      .insert(sketches)
      .values({
        detailId,
        authorId: testerUserId,
        status: "PUBLISHED",
        strokesJson: [],
        thumbnailUrl: uploaded.url,
      })
      .returning({ id: sketches.id });
    sketchId = row.id;
    await page.goto(`/s/${sketchId}`);
    const image = page.locator(`img[src^="/api/files/sketch/${sketchId}"]`);
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    if (sketchId) await db.delete(sketches).where(eq(sketches.id, sketchId));
    await deleteOwnBlob(uploaded.url);
  }
});

test("schiță publicată → randează teaser cu autor + CTA de signup", async ({ page }) => {
  const { detailId, detailTitle, testerUserId } = getSeed();

  const [row] = await db
    .insert(sketches)
    .values({ detailId, authorId: testerUserId, status: "PUBLISHED", strokesJson: [] })
    .returning({ id: sketches.id });

  try {
    await page.goto(`/s/${row.id}`);
    await expect(page).toHaveTitle(new RegExp(detailTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(
      page.getByRole("heading", { name: `Schiță peste „${detailTitle}”` }),
    ).toBeVisible();
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
