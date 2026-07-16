import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { details } from "../db/schema";
import { createDetail } from "../server/services/detailService";
import { pickLeafCategories } from "./category-helpers";
import { getSeed } from "./seed";

// Editare detaliu existent (PUBLISHED) — netestat până acum (doar creare+ștergere aveau e2e).
// Fiecare test își creează propriul detaliu (autorat de tester), ca să nu depindă de/nu strice
// detaliul seedat (autorat de author, folosit de authed.spec.ts pt validare pe rol).

// NU un URL fals ("e2e.public.blob..."): `createDetail()` (service) nu validează store-ul, dar
// `updateDetailAction` (ruta reală de editare) verifică `isOwnBlobUrl` chiar și când imaginea nu
// s-a schimbat → un fixture cu URL fals pică editarea cu IMAGE_REQUIRED, deși nu e bug de aplicație.
// Hostname-ul de mai jos e store-ul REAL de Blob al acestui mediu (derivat dintr-un imageUrl real
// existent în DB) — obiectul nu trebuie să existe efectiv (isOwnBlobUrl verifică doar formatul/hostname-ul,
// iar reprocesarea SEC-02 rulează doar când `imageChanged=true`, ceea ce nu e cazul aici).
const OWN_STORE_IMAGE_URL = "https://oqhrxxllqvcxn05s.public.blob.vercel-storage.com/details/e2e-placeholder.png";


test.describe.serial("Editare detaliu existent", () => {
  // getSeed() NU se apelează în scope-ul describe: describe-urile se execută la COLECTAREA testelor,
  // înainte ca proiectul "setup" să scrie e2e/.auth/seed.json → pe o mașină proaspătă (CI) pică cu
  // ENOENT. Se citește lazy, în beforeAll (după setup).
  let categoryId: string;
  let detailId: string | null = null;
  const originalTitle = `E2E editare — original ${Date.now()}`;

  test.beforeAll(async () => {
    const { testerUserId, categoryId: seededCategoryId } = getSeed();
    categoryId = seededCategoryId;
    const created = await createDetail({
      authorId: testerUserId,
      title: originalTitle,
      categoryIds: [categoryId],
      imageUrl: OWN_STORE_IMAGE_URL,
      resources: [],
    });
    expect(created.ok).toBe(true);
    if (created.ok) detailId = created.detailId;
  });

  test.afterAll(async () => {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
  });

  test("autorul editează titlul + categoria → schimbările apar pe pagina detaliului", async ({ page }) => {
    const categoryPair = await pickLeafCategories(2);
    const otherCategory = categoryPair.find((c) => c.id !== categoryId) ?? categoryPair[0];
    const newTitle = `E2E editare — modificat ${Date.now()}`;

    await page.goto(`/details/${detailId}/edit`);
    await expect(page.getByRole("heading", { name: "Editează detaliul" })).toBeVisible();

    await page.locator("#title").fill(newTitle);

    // Comută categoria: bifează una nouă (categoria originală rămâne bifată — testul verifică
    // doar că selecția se poate SCHIMBA și se salvează, nu o combinație exactă de categorii finale).
    await page.getByTestId("category-dropdown-trigger").click();
    await page.getByRole("button", { name: otherCategory.name, exact: true }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Salvează modificările" }).click();

    await expect(page).toHaveURL(`/details/${detailId}`, { timeout: 15_000 });
    // NU page.getByText(newTitle) — titlul apare de 2 ori (breadcrumb-ul din navigation + heading-ul
    // paginii) → strict-mode violation. Heading-ul e ținta reală a testului.
    await expect(page.getByRole("heading", { name: newTitle })).toBeVisible();
  });

  test("golirea tuturor categoriilor → eroare de validare, rămâne pe formular", async ({ page }) => {
    await page.goto(`/details/${detailId}/edit`);

    // Deschide dropdown-ul și debifează tot ce e bifat (click pe fiecare buton aria-pressed=true).
    // SCOPAT strict la panoul de categorii (2026-07-16) — un selector global pe pagină ar prinde și
    // alte pill-uri cu aria-pressed (ex. locație, upload/desenează), nu doar categoriile.
    await page.getByTestId("category-dropdown-trigger").click();
    const pressedButtons = page
      .getByTestId("category-dropdown-panel")
      .locator('button[aria-pressed="true"]');
    const count = await pressedButtons.count();
    for (let i = 0; i < count; i++) {
      await pressedButtons.first().click();
    }
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Salvează modificările" }).click();

    // NU page.getByRole("alert") — Next.js are mereu în DOM un route-announcer (role="alert") care
    // ar face locatorul strict-mode ambiguu.
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(`/details/${detailId}/edit`);
  });

  test("non-autor care deschide /edit → redirect la pagina publică (nu 404)", async ({ page }) => {
    // Detaliul seedat (auth.setup.ts) e autorat de `author`, nu de userul de sesiune (`tester`).
    const { detailId: authorDetailId } = getSeed();
    await page.goto(`/details/${authorDetailId}/edit`);
    await expect(page).toHaveURL(`/details/${authorDetailId}`);
  });
});

// Locație (2026-07-16, cerere Edi): pill „România" (context tehnic RO) vs „Altă locație" (text liber,
// context tehnic ascuns). Detaliu propriu, izolat de blocul de mai sus.
test.describe.serial("Editare detaliu — locație / context tehnic", () => {
  let categoryId: string;
  let detailId: string | null = null;

  test.beforeAll(async () => {
    const { testerUserId, categoryId: seededCategoryId } = getSeed();
    categoryId = seededCategoryId;
    const created = await createDetail({
      authorId: testerUserId,
      title: `E2E locație — ${Date.now()}`,
      categoryIds: [categoryId],
      imageUrl: OWN_STORE_IMAGE_URL,
      resources: [],
    });
    expect(created.ok).toBe(true);
    if (created.ok) detailId = created.detailId;
  });

  test.afterAll(async () => {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
  });

  test("pill „Altă locație” ascunde Context tehnic; salvat corect afișează locația pe pagina publică", async ({
    page,
  }) => {
    await page.goto(`/details/${detailId}/edit`);
    await expect(page.getByText("Context tehnic")).toBeVisible();

    await page.getByRole("button", { name: "Altă locație" }).click();
    await expect(page.getByText("Context tehnic")).toHaveCount(0);

    await page.getByPlaceholder("Țară, oraș").fill("Italia, Roma");
    await page.getByRole("button", { name: "Salvează modificările" }).click();

    await expect(page).toHaveURL(`/details/${detailId}`, { timeout: 15_000 });
    await expect(page.getByText("Italia, Roma")).toBeVisible();
  });

  test("„Altă locație” fără text completat → eroare de validare, rămâne pe formular", async ({ page }) => {
    await page.goto(`/details/${detailId}/edit`);
    await page.getByRole("button", { name: "Altă locație" }).click();
    // Golit EXPLICIT — testul anterior din același bloc a lăsat deja „Italia, Roma" salvat, deci
    // pillul „Altă locație" pornește cu textul precompletat; fără fill(""), am testa un caz valid.
    await page.getByPlaceholder("Țară, oraș").fill("");
    await page.getByRole("button", { name: "Salvează modificările" }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(`/details/${detailId}/edit`);
  });

  test("revenire la pillul „România” readuce Context tehnic vizibil", async ({ page }) => {
    await page.goto(`/details/${detailId}/edit`);
    await page.getByRole("button", { name: "România" }).click();
    await expect(page.getByText("Context tehnic")).toBeVisible();
  });
});

// Resursă IMAGE (2026-07-16, cerere Edi): thumbnail real + lightbox, NU link/chip generic ca PDF/LINK/CAD.
test.describe.serial("Resursă suplimentară — IMAGE afișată ca imagine, cu lightbox", () => {
  let detailId: string | null = null;

  test.beforeAll(async () => {
    const { testerUserId, categoryId } = getSeed();
    const created = await createDetail({
      authorId: testerUserId,
      title: `E2E resursă imagine — ${Date.now()}`,
      categoryIds: [categoryId],
      imageUrl: OWN_STORE_IMAGE_URL,
      resources: [{ type: "IMAGE", url: OWN_STORE_IMAGE_URL }],
    });
    expect(created.ok).toBe(true);
    if (created.ok) detailId = created.detailId;
  });

  test.afterAll(async () => {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
  });

  test("resursa IMAGE apare ca thumbnail; click → lightbox cu imaginea mărită", async ({ page }) => {
    await page.goto(`/details/${detailId}`);

    const thumbnail = page.getByRole("button", { name: /Mărește imaginea/ });
    await expect(thumbnail).toBeVisible();
    // NU e link extern — un chip PDF/LINK ar fi un <a>, thumbnail-ul e strict <button>.
    await expect(page.locator("a", { hasText: "e2e-placeholder" })).toHaveCount(0);

    await thumbnail.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Închide" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
