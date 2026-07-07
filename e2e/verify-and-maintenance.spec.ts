import { expect, test } from "@playwright/test";

// E2E — /verify (pas intermediar anti-prefetch al magic link-ului de USER) și /maintenance (ecranul
// static de mentenanță). Anonim, fără DB. NU testăm consumul real al unui token Auth.js (necesită email
// real din Resend) — doar ramurile deterministe: lipsă param, și SEC-03 (anti open-redirect).

test.describe("/verify", () => {
  test("fără param u → Link invalid, fără AutoVerify", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByText("Link invalid")).toBeVisible();
    await expect(page.getByRole("link", { name: "Înapoi la autentificare" })).toBeVisible();
  });

  test("SEC-03: u pe altă origine → respins ca link invalid (anti open-redirect)", async ({ page }) => {
    await page.goto(`/verify?u=${encodeURIComponent("https://evil.example.com/api/auth/callback/resend")}`);
    await expect(page.getByText("Link invalid")).toBeVisible();
  });

  test("SEC-03: u pe origine proprie dar path greșit (nu /api/auth/callback/) → respins", async ({
    page,
    baseURL,
  }) => {
    const target = new URL("/feed", baseURL ?? "http://localhost:3000").toString();
    await page.goto(`/verify?u=${encodeURIComponent(target)}`);
    await expect(page.getByText("Link invalid")).toBeVisible();
  });
});

test("/maintenance randează ecranul static (public, indiferent de lockdown)", async ({ page }) => {
  await page.goto("/maintenance");
  await expect(page).toHaveURL(/\/maintenance$/);
  await expect(page.getByRole("heading", { name: "Site în lucru" })).toBeVisible();
});
