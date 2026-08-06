import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { and, eq, like } from "drizzle-orm";

import { db } from "../db";
import { comments, detailCategories, details, validations } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { getSeed } from "./seed";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — foaia de lucru 2026-08-06, itemii care schimbă comportament observabil în browser:
//   item 6  — Aprob/Dezaprob funcționează ACUM și pe propriul conținut (guard eliminat)
//   item 10 — imagine atașată la comentariu (upload real → re-encodare server-side → afișare)
//   item 3  — data publicării apare în feed
//   item 4  — contorul de vizualizări crește la fiecare încărcare de pagină
//
// Itemii 8, 9, 7 (Ctrl+Z, duplicare text, bara de culoare) sunt în editorul de canvas — se verifică
// manual; un e2e pe ei ar testa mai mult sincronizarea pointerelor decât regula de business.

const IMAGE_URL = "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png";

// Același PNG 8x8 valid ca în detail-annotation.spec.ts (trecut prin pipeline-ul real de re-encodare).
const SMALL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQI12O4Y6OBFTEMLQkAb5lQAcZEZ3sAAAAASUVORK5CYII=";

function makeImage(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "detalia-worksheet-"));
  const file = path.join(dir, name);
  writeFileSync(file, Buffer.from(SMALL_PNG_BASE64, "base64"));
  return file;
}

test.describe.serial("Item 6 — autorul poate lua poziție pe PROPRIUL detaliu", () => {
  let detailId = "";

  test.beforeAll(async () => {
    const { testerUserId, categoryId } = getSeed();
    const [row] = await db
      .insert(details)
      .values({
        title: `E2E auto-validare ${Date.now()}`,
        authorId: testerUserId,
        imageUrl: IMAGE_URL,
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

  test("butonul Aprob e vizibil pe propriul detaliu și poziția se înregistrează", async ({ page }) => {
    await page.goto(`/details/${detailId}`);

    // Înainte de 2026-08-06 butoanele nici nu apăreau pe propriul conținut (CANNOT_VALIDATE_OWN).
    const aprob = page.getByRole("button", { name: "Aprob", exact: true });
    await expect(aprob).toBeVisible();
    await aprob.click();

    await expect(page.getByRole("button", { name: /Retrage|Aprobat/i }).first()).toBeVisible();

    // Butonul devine "Aprobat" optimist (useOptimistic, în validation-panel.tsx) ÎNAINTE ca
    // server action-ul să fi comis efectiv rândul — un query imediat pe DB poate prinde cursa.
    const selectRow = () =>
      db
        .select({ position: validations.position })
        .from(validations)
        .where(
          and(
            eq(validations.userId, getSeed().testerUserId),
            eq(validations.targetType, "DETAIL"),
            eq(validations.targetId, detailId),
          ),
        );
    await expect.poll(async () => (await selectRow()).length, { timeout: 5_000 }).toBe(1);
    const [row] = await selectRow();
    expect(row.position).toBe("APPROVE");
  });
});

test.describe.serial("Item 10 — imagine atașată la comentariu", () => {
  const body = `E2E comentariu cu poză ${Date.now()}`;

  test.afterAll(async () => {
    const { detailId } = getSeed();
    // Ștergem prin UI-ul de business ar cere alt test; aici curățăm direct, dar recuperăm întâi URL-ul
    // ca să nu lăsăm fișierul orfan în Blob (exact grija pe care o are și codul de producție).
    const rows = await db
      .select({ imageUrl: comments.imageUrl })
      .from(comments)
      .where(and(eq(comments.targetId, detailId), like(comments.body, "E2E comentariu cu poză %")));
    await db.delete(comments).where(and(eq(comments.targetId, detailId), like(comments.body, "E2E comentariu cu poză %")));
    await deleteBlobs(rows.map((r) => r.imageUrl));
  });

  test("atașezi o poză, comentariul o afișează, iar URL-ul salvat e cel RE-PROCESAT de server", async ({
    page,
  }) => {
    // Upload-ul merge direct browser → Blob; header-ele de bypass ale preview-ului ar strica semnătura.
    await stripBypassHeadersForBlobUploads(page);

    const { detailId } = getSeed();
    await page.goto(`/details/${detailId}`);

    await page.getByPlaceholder(/Adaugă la dezbatere/).fill(body);

    const attach = page.getByRole("button", { name: /Atașează o poză/ });
    await expect(attach).toBeVisible();
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), attach.click()]);
    await chooser.setFiles(makeImage("comentariu.png"));

    // Previzualizarea apare abia după ce upload-ul s-a terminat (butonul e înlocuit de thumbnail).
    await expect(page.getByAltText("Imaginea atașată comentariului")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Comentează" }).click();

    const posted = page.locator(`li:has-text("${body}")`).first();
    await expect(posted).toBeVisible({ timeout: 15_000 });
    // Butonul-thumbnail din listă, NU imaginea mărită din lightbox — ambele au același `alt`
    // ("Imagine atașată comentariului"), deci getByAltText e ambiguu (strict-mode violation).
    await expect(posted.getByRole("button", { name: "Imagine atașată comentariului" })).toBeVisible();

    // Serverul NU salvează URL-ul brut trimis de client: îl re-încarcă curat sub `u/<userId>/comments/`.
    const [row] = await db
      .select({ imageUrl: comments.imageUrl })
      .from(comments)
      .where(and(eq(comments.targetId, detailId), eq(comments.body, body)));
    expect(row.imageUrl).toContain(`/u/${getSeed().testerUserId}/comments/`);
  });
});

test.describe("Itemii 3 și 4 — data publicării și contorul de vizualizări", () => {
  test("cardul din feed arată data publicării", async ({ page }) => {
    const { detailId, detailTitle } = getSeed();
    await page.goto(`/feed?q=${encodeURIComponent(detailTitle.split(" ")[0])}`);

    const card = page.locator(`article:has(a[href="/details/${detailId}"])`).first();
    await expect(card).toBeVisible();
    // <time> cu dateTime — textul e relativ („acum 3 zile") sau dată exactă peste 7 zile; ambele valide.
    await expect(card.locator("time")).toBeVisible();
    await expect(card.locator("time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}/);
  });

  test("fiecare încărcare a paginii detaliului incrementează contorul", async ({ page }) => {
    const { detailId } = getSeed();

    const before = (
      await db.select({ views: details.views }).from(details).where(eq(details.id, detailId))
    )[0].views;

    await page.goto(`/details/${detailId}`);
    await expect(page.getByRole("button", { name: "Acțiuni detaliu" })).toBeVisible();

    // Incrementul rulează prin `after()` — DUPĂ ce răspunsul a plecat, deci poate ateriza cu întârziere.
    await expect
      .poll(
        async () =>
          (await db.select({ views: details.views }).from(details).where(eq(details.id, detailId)))[0].views,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(before);
  });
});
