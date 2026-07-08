import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { adminLoginTokens, adminSessions } from "../db/schema";

// E2E — accesul la /admin-page: sesiune SEPARATĂ de useri (cookie propriu, allowlist ADMIN_EMAILS).
// NU folosim un email admin real (secret de mediu, necunoscut aici) — testăm doar căile care sunt
// adevărate INDIFERENT de conținutul allowlist-ului: anonim respins, sesiune re-verificată la fiecare
// citire (email scos din allowlist între timp → tratat ca neautentificat), token expirat/invalid respins.
// Acoperă „privilege escalation" din docs/PLAN-TESTE.md §Securitate.

const NOT_ADMIN_EMAIL = "e2e-not-admin@detalia.test";
const COOKIE = "detalia-admin-session";

test("anonim → /admin-page redirectează la /admin-page/login", async ({ page }) => {
  await page.goto("/admin-page");
  await expect(page).toHaveURL(/\/admin-page\/login$/);
  await expect(page.getByRole("heading", { name: "Administrare DETALIA" })).toBeVisible();
});

test("sesiune validă în DB dar emailul NU e (mai) în allowlist → tratată ca neautentificat", async ({
  browser,
  baseURL,
}) => {
  const token = `e2e-admin-session-${Date.now()}`;
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(adminSessions).values({ token, email: NOT_ADMIN_EMAIL, expires });

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: COOKIE,
          value: token,
          domain: url.hostname,
          path: "/admin-page",
          expires: Math.floor(expires.getTime() / 1000),
          httpOnly: true,
          secure,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });

  try {
    const page = await context.newPage();
    await page.goto("/admin-page");
    await expect(page).toHaveURL(/\/admin-page\/login$/);
  } finally {
    await context.close();
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }
});

test("sesiune expirată în DB → redirect la login", async ({ browser, baseURL }) => {
  const token = `e2e-admin-session-expired-${Date.now()}`;
  const expired = new Date(Date.now() - 60 * 1000);
  await db.insert(adminSessions).values({ token, email: NOT_ADMIN_EMAIL, expires: expired });

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: COOKIE,
          value: token,
          domain: url.hostname,
          path: "/admin-page",
          expires: Math.floor((Date.now() + 3600_000) / 1000),
          httpOnly: true,
          secure,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });

  try {
    const page = await context.newPage();
    await page.goto("/admin-page");
    await expect(page).toHaveURL(/\/admin-page\/login$/);
  } finally {
    await context.close();
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }
});

test("token de magic-link necunoscut → confirm redirectează la login cu eroare", async ({ page }) => {
  await page.goto("/admin-page/verify/confirm?token=e2e-nonexistent-token");
  await expect(page).toHaveURL(/\/admin-page\/login\?error=link$/);
  await expect(page.getByText("Link invalid sau expirat. Cere unul nou.")).toBeVisible();
});

test("magic-link pentru email NEadmin → consumă tokenul dar nu creează sesiune (login cu eroare)", async ({
  page,
}) => {
  const token = `e2e-admin-token-notadmin-${Date.now()}`;
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(adminLoginTokens).values({ token, email: NOT_ADMIN_EMAIL, expires });

  await page.goto(`/admin-page/verify/confirm?token=${token}`);
  await expect(page).toHaveURL(/\/admin-page\/login\?error=link$/);

  // Tokenul e one-time — chiar dacă a eșuat (email neadmin), a fost consumat (șters), nu reutilizabil.
  const remaining = await db.select().from(adminLoginTokens).where(eq(adminLoginTokens.token, token));
  expect(remaining).toHaveLength(0);
});

test("pagina /admin-page/verify (anti-prefetch) fără token → link invalid, fără auto-consum", async ({
  page,
}) => {
  await page.goto("/admin-page/verify");
  await expect(page.getByRole("heading", { name: "Link invalid" })).toBeVisible();
});
