import { expect, test } from "@playwright/test";

// E2E — fluxuri PUBLICE (fără autentificare). Acoperă suprafața vizibilă oricui + poarta deny-by-default.
// Nu trimit formularul de signup (ar declanșa email real + rate limit) — doar verific că UI-ul e prezent
// și interactiv. Fluxurile authed (publicare detaliu, validare, schiță) = increment separat, cu sesiune seedată.

test.describe("Landing", () => {
  test("se încarcă și are CTA către signup și login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DETALIA/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // CTA-uri din header (linkuri stabile, nu stiluri).
    await expect(page.getByRole("link", { name: "Creează cont", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Autentificare", exact: true }).first()).toBeVisible();
  });

  test("click pe Creează cont duce la /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Creează cont", exact: true }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe("Autentificare (UI passwordless)", () => {
  test("/login randează formularul de magic link", async ({ page }) => {
    await page.goto("/login");
    // CardTitle e un <div>, nu un heading → assert pe text + pe controalele reale (role-based, unice).
    await expect(page.getByText("Autentificare", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trimite link-ul de acces" })).toBeVisible();
  });

  test("/signup randează formularul de creare cont", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("Creează cont", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Creează cont cu email" })).toBeVisible();
  });

  test("login ⇄ signup sunt legate reciproc", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Creează unul" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.getByRole("link", { name: /Autentific/ }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/verify-request e public și brandat (română)", async ({ page }) => {
    await page.goto("/verify-request");
    await expect(page.getByText("Verifică-ți email-ul", { exact: true })).toBeVisible();
  });
});

test.describe("Poarta deny-by-default", () => {
  test("ruta protejată ca anonim → redirect la /login cu callbackUrl", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("o altă rută protejată (profil) ca anonim → /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rută inexistentă (sub prefix public) → 404", async ({ page }) => {
    // O rută inexistentă NEPUBLICĂ ar fi prinsă de poarta deny-by-default (→ redirect /login), nu 404.
    // Sub un prefix public (`/signup/...`) trece de poartă și ajunge la 404-ul real al Next.
    const res = await page.goto("/signup/ruta-care-nu-exista-123");
    expect(res?.status()).toBe(404);
  });
});
