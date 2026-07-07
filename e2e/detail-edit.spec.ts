import { expect, test } from "@playwright/test";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "../db";
import { categories, details } from "../db/schema";
import { createDetail } from "../server/services/detailService";
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

async function pickTwoLeafCategories(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(isNotNull(categories.parentId), eq(categories.isGroup, false)))
    .limit(2);
  if (rows.length < 2) throw new Error("Nevoie de cel puțin 2 categorii leaf pt acest test.");
  return rows;
}

test.describe.serial("Editare detaliu existent", () => {
  const { categoryId } = getSeed();
  let detailId: string | null = null;
  const originalTitle = `E2E editare — original ${Date.now()}`;

  test.beforeAll(async () => {
    const { testerUserId } = getSeed();
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
    const categoryPair = await pickTwoLeafCategories();
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
    await expect(page.getByText(newTitle)).toBeVisible();
  });

  test("golirea tuturor categoriilor → eroare de validare, rămâne pe formular", async ({ page }) => {
    await page.goto(`/details/${detailId}/edit`);

    // Deschide dropdown-ul și debifează tot ce e bifat (click pe fiecare buton aria-pressed=true).
    await page.getByTestId("category-dropdown-trigger").click();
    const pressedButtons = page.locator('button[aria-pressed="true"]');
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
