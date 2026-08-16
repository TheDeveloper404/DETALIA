import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { comments, detailCategories, details } from "../db/schema";
import { getSeed } from "./seed";

// E2E — item 5 din foaia de lucru (2026-08-06), partea CRITICĂ:
// ștergerea unui detaliu se comportă DIFERIT după cum a strâns sau nu interacțiuni.
//   • fără nicio interacțiune  → dispare complet (comportamentul dinainte)
//   • cu cel puțin una         → conținutul RĂMÂNE, autorul se retrage („Autor șters" + rolul lui)
//
// Acoperă exact ce testele unitare NU pot: dialogul real (textul diferă în cele două cazuri),
// randarea de după, blocarea editării și dispariția detaliului de pe profilul autorului.
//
// Detaliile de test se creează direct în DB (autorate de TESTERUL logat, ca să apară butonul de
// ștergere) și se curăță la final — nu reutilizăm detaliul seedat, care e al altui user.

const IMAGE_URL = "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png";

async function createOwnDetail(title: string): Promise<string> {
  const { testerUserId, categoryId } = getSeed();
  const [row] = await db
    .insert(details)
    .values({
      title,
      description: "Detaliu creat de suita E2E pentru testarea ștergerii.",
      authorId: testerUserId,
      imageUrl: IMAGE_URL,
      status: "PUBLISHED",
    })
    .returning({ id: details.id });
  await db.insert(detailCategories).values({ detailId: row.id, categoryId });
  return row.id;
}

async function removeDetail(detailId: string): Promise<void> {
  await db.delete(comments).where(and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId)));
  await db.delete(details).where(eq(details.id, detailId));
}

test.describe.serial("Ștergere detaliu FĂRĂ interacțiuni → dispare complet", () => {
  let detailId = "";
  const title = `E2E ștergere completă ${Date.now()}`;

  test.beforeAll(async () => {
    detailId = await createOwnDetail(title);
  });

  test.afterAll(async () => {
    // Idempotent: dacă testul a mers, rândul nu mai există și delete-ul e no-op.
    if (detailId) await removeDetail(detailId);
  });

  test("meniul oferă ștergerea completă, iar confirmarea elimină rândul din DB", async ({ page }) => {
    await page.goto(`/details/${detailId}`);
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();

    // Eticheta e cea de ȘTERGERE (nu de retragere) — semnalul că serverul a calculat HARD_DELETE.
    const deleteItem = page.getByRole("menuitem", { name: "Șterge detaliul" });
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();

    await expect(page.getByText("Ștergi acest detaliu?")).toBeVisible();
    await expect(page.getByText(/se șterg definitiv/i)).toBeVisible();
    await page.getByRole("button", { name: "Șterge" }).click();

    await page.waitForURL("**/feed");

    // Sursa de adevăr e DB-ul, nu absența din UI (feed-ul e finit — lipsa de acolo n-ar dovedi nimic).
    const rows = await db.select({ id: details.id }).from(details).where(eq(details.id, detailId));
    expect(rows).toHaveLength(0);
  });
});

test.describe.serial("Ștergere detaliu CU interacțiuni → autorul se retrage, conținutul rămâne", () => {
  let detailId = "";
  const title = `E2E retragere autor ${Date.now()}`;
  const commentBody = "Comentariu E2E care blochează ștergerea completă.";

  test.beforeAll(async () => {
    const { authorUserId } = getSeed();
    detailId = await createOwnDetail(title);
    // Interacțiunea vine de la ALTCINEVA (autorul seedat), ca în realitate.
    await db.insert(comments).values({
      targetType: "DETAIL",
      targetId: detailId,
      authorId: authorUserId,
      body: commentBody,
    });
  });

  test.afterAll(async () => {
    if (detailId) await removeDetail(detailId);
  });

  test("dialogul anunță retragerea, nu ștergerea", async ({ page }) => {
    await page.goto(`/details/${detailId}`);
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();

    // Eticheta S-A SCHIMBAT — userul vede din meniu că nu mai e o ștergere.
    await expect(page.getByRole("menuitem", { name: "Șterge detaliul" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Retrage-te din detaliu" }).click();

    await expect(page.getByText("Te retragi din acest detaliu?")).toBeVisible();
    await expect(page.getByText(/conținutul rămâne pentru ceilalți/i)).toBeVisible();
    await expect(page.getByText(/Autor șters/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retrage-mă" })).toBeVisible();
  });

  test("după confirmare: detaliul EXISTĂ, arată Autor șters, comentariul e neatins", async ({
    page,
  }) => {
    await page.goto(`/details/${detailId}`);
    await page.getByRole("button", { name: "Acțiuni detaliu" }).click();
    await page.getByRole("menuitem", { name: "Retrage-te din detaliu" }).click();
    await page.getByRole("button", { name: "Retrage-mă" }).click();
    await page.waitForURL("**/feed");

    // Detaliul NU a dispărut din DB — s-a marcat doar retragerea.
    const [row] = await db
      .select({ anonymizedAt: details.anonymizedAt, authorId: details.authorId })
      .from(details)
      .where(eq(details.id, detailId));
    expect(row.anonymizedAt).not.toBeNull();
    // `author_id` rămâne în DB (audit) — anonimizarea e la nivel de afișare.
    expect(row.authorId).toBe(getSeed().testerUserId);

    await page.goto(`/details/${detailId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Autor șters").first()).toBeVisible();
    // Rolul SUPRAVIEȚUIEȘTE retragerii (din snapshot) — asta e cerința, nu doar ascunderea numelui.
    await expect(page.getByText(commentBody)).toBeVisible();
  });

  test("autorul retras nu mai poate edita detaliul", async ({ page }) => {
    const res = await page.goto(`/details/${detailId}/edit`);
    // Poarta e `getDetailForEdit` (server): fie 404, fie redirect — în niciun caz formularul de editare.
    expect(page.url()).not.toContain("/edit");
    if (res) expect([200, 404]).toContain(res.status());
  });

  test("detaliul retras nu mai apare pe profilul fostului autor (altfel legătura s-ar reface)", async ({
    page,
  }) => {
    await page.goto(`/profile/${getSeed().testerUserId}`);
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
