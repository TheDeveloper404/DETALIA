import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — /profile/edit: editarea datelor de profil + secțiunea de verificare rol (pe HOLD, doar text static).
// Rolul propriu-zis NU se editează aici (definitiv) — nu testăm schimbare de rol.

// PNG 1x1 roșu, valid, ~70 bytes — identic cu fixture-ul din detail-upload.spec.ts (reprocessBlobImage,
// SEC-02, validează conținutul real, nu doar extensia).
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function writeTinyPng(): string {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "detalia-e2e-"));
  const imagePath = path.join(tmpDir, "tiny.png");
  writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));
  return imagePath;
}

const TEST_EMAIL = "e2e-tester@detalia.test";

test.describe("Editare profil", () => {
  test("pagina se încarcă cu formularul precompletat", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByRole("heading", { name: "Detalii profil" })).toBeVisible();
    await expect(page.getByLabel("Nume afișat")).toHaveValue("E2E Tester");
  });

  test("verificarea rolului arată mesajul de HOLD (funcție indisponibilă)", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: "Verificarea rolului" })).toBeVisible();
    await expect(page.getByText("Această funcție nu este încă disponibilă.")).toBeVisible();
  });

  test("editează headline → salvează → mesaj de succes + valoare persistă la reload", async ({ page }) => {
    await page.goto("/profile/edit");
    const headline = page.getByLabel(/Titlu\/headline/);
    const value = `E2E headline ${Date.now()}`;
    await headline.fill(value);
    await page.getByRole("button", { name: "Salvează profilul" }).click();

    await expect(page.getByRole("status")).toHaveText("Profilul a fost actualizat.");
    await page.reload();
    await expect(page.getByLabel(/Titlu\/headline/)).toHaveValue(value);
  });

  test("nume gol → eroare de validare, rămâne pe formular", async ({ page }) => {
    await page.goto("/profile/edit");
    await page.getByLabel("Nume afișat").fill("");
    await page.getByRole("button", { name: "Salvează profilul" }).click();

    await expect(page).toHaveURL(/\/profile\/edit/);
    // required nativ blochează submit-ul — formularul rămâne, fără eroare de server necesară aici.
    await expect(page.getByLabel("Nume afișat")).toHaveValue("");
  });
});

// Avatar + cover (`EditProfileHeader`) — upload real în Blob (SEC-02 reprocessBlobImage validează
// conținutul, nu doar extensia) + persistare (saveAvatarUrl/saveCoverUrl/saveCoverPosition) + ștergere
// (deleteAvatar/deleteCover). Serial: toate ating ACELAȘI rând `users` (e2e-tester, refolosit de multe
// spec-uri în paralel) — fără serial, upload și delete concurente pe același user ar da o cursă reală,
// nu doar teoretică. `afterAll` restaurează starea inițială (null/null/50), ca alte spec-uri paralele
// din alte fișiere să nu găsească un avatar/cover neașteptat pe profil.
test.describe.serial("Avatar și cover — /profile/edit", () => {
  const uploadedBlobUrls: string[] = [];

  test.afterAll(async () => {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, TEST_EMAIL));
    if (row) {
      await db
        .update(users)
        .set({ image: null, coverImage: null, coverPosition: 50 })
        .where(eq(users.id, row.id));
    }
    if (uploadedBlobUrls.length > 0) await deleteBlobs(uploadedBlobUrls);
  });

  test("avatar: upload → apare în UI + persistă în DB", async ({ page }) => {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/profile/edit");

    await page.getByTestId("avatar-file-input").setInputFiles(writeTinyPng());
    // Fără pas separat de "Salvează" (upload → server action direct) — butonul de ștergere apare doar
    // când avatarul e setat, deci vizibilitatea lui confirmă round-trip-ul complet.
    await expect(page.getByRole("button", { name: "Șterge poza de profil" })).toBeVisible({
      timeout: 15_000,
    });

    const [row] = await db.select({ image: users.image }).from(users).where(eq(users.email, TEST_EMAIL));
    expect(row?.image).toMatch(/^https:\/\//);
    if (row?.image) uploadedBlobUrls.push(row.image);
  });

  test("avatar: șterge → dispare din UI + DB", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/profile/edit");

    await expect(page.getByRole("button", { name: "Șterge poza de profil" })).toBeVisible();
    await page.getByRole("button", { name: "Șterge poza de profil" }).click();
    await expect(page.getByRole("button", { name: "Șterge poza de profil" })).toHaveCount(0);

    const [row] = await db.select({ image: users.image }).from(users).where(eq(users.email, TEST_EMAIL));
    expect(row?.image).toBeNull();
  });

  test("cover: upload → apare în UI + persistă în DB", async ({ page }) => {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/profile/edit");

    await page.getByTestId("cover-file-input").setInputFiles(writeTinyPng());
    await expect(page.getByRole("button", { name: "Șterge imaginea de cover" })).toBeVisible({
      timeout: 15_000,
    });

    const [row] = await db
      .select({ coverImage: users.coverImage })
      .from(users)
      .where(eq(users.email, TEST_EMAIL));
    expect(row?.coverImage).toMatch(/^https:\/\//);
    if (row?.coverImage) uploadedBlobUrls.push(row.coverImage);
  });

  test("cover: repoziționare (drag) → poziția se salvează în DB", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page.getByText("trage sus/jos pentru a repoziționa")).toBeVisible();

    const [before] = await db
      .select({ coverPosition: users.coverPosition })
      .from(users)
      .where(eq(users.email, TEST_EMAIL));

    // Bandă de cover (bandRef) — span-ul e copil direct al ei. Drag vertical simplu, sus (poziția
    // trebuie să se schimbe față de default-ul 50).
    const band = page.getByText("trage sus/jos pentru a repoziționa").locator("..");
    const box = await band.boundingBox();
    if (!box) throw new Error("banda de cover fără bounding box");
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height - 10);
    await page.mouse.down();
    await page.mouse.move(x, box.y + 10, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(
        async () => {
          const [row] = await db
            .select({ coverPosition: users.coverPosition })
            .from(users)
            .where(eq(users.email, TEST_EMAIL));
          return row?.coverPosition ?? null;
        },
        { timeout: 5_000 },
      )
      .not.toBe(before?.coverPosition ?? 50);
  });

  test("cover: șterge → dispare din UI + DB", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/profile/edit");

    await expect(page.getByRole("button", { name: "Șterge imaginea de cover" })).toBeVisible();
    await page.getByRole("button", { name: "Șterge imaginea de cover" }).click();
    await expect(page.getByRole("button", { name: "Șterge imaginea de cover" })).toHaveCount(0);

    const [row] = await db
      .select({ coverImage: users.coverImage })
      .from(users)
      .where(eq(users.email, TEST_EMAIL));
    expect(row?.coverImage).toBeNull();
  });
});
