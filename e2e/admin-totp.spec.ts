import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { adminLoginTokens, adminPendingSessions, adminTotp } from "../db/schema";
import { hashToken } from "../lib/admin-auth";

// E2E — al doilea factor de admin (SEC-P02).
//
// Regula de domeniu verificată aici, citată din `db/schema.ts`:
//   „un rând în `admin_sessions` înseamnă «ambii factori trecuți» — magic link ȘI TOTP. Factorul
//    intermediar stă în `admin_pending_sessions` […] ZERO privilegii — singura rută care o acceptă
//    e /admin-page/totp."
// Deci actorul acestor teste NU e un admin autentificat, ci cineva care a trecut DOAR de magic link
// (are inbox-ul, nu și telefonul). Ce trebuie să fie adevărat: ajunge la ecranul de cod și la NIMIC
// altceva sub /admin-page.
//
// Ca în `admin-access.spec.ts`, nu hardcodăm un email de admin (allowlist-ul e secret de mediu) —
// testele care au nevoie de unul îl iau din `ADMIN_EMAILS` și se sar dacă lipsește.

const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
const NOT_ADMIN_EMAIL = "e2e-totp-not-admin@detalia.test";
const PENDING_COOKIE = "detalia-admin-pending";

// Injectează o sesiune intermediară (DB + cookie) și întoarce un context de browser care o poartă.
async function contextWithPending(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  email: string,
  { expired = false }: { expired?: boolean } = {},
) {
  const token = `e2e-admin-pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const expires = new Date(Date.now() + (expired ? -60_000 : 10 * 60_000));
  // DB stochează hash-ul; cookie-ul poartă tokenul brut — vezi `lib/admin-auth.ts`.
  await db.insert(adminPendingSessions).values({ token: hashToken(token), email, expires });

  const url = new URL(baseURL ?? "http://localhost:3000");
  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: PENDING_COOKIE,
          value: token,
          domain: url.hostname,
          path: "/admin-page",
          expires: Math.floor((Date.now() + 3600_000) / 1000),
          httpOnly: true,
          secure: url.protocol === "https:",
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });

  const cleanup = async () => {
    await context.close();
    await db.delete(adminPendingSessions).where(eq(adminPendingSessions.token, hashToken(token)));
  };
  return { context, cleanup };
}

test("anonim → /admin-page/totp redirectează la login", async ({ page }) => {
  await page.goto("/admin-page/totp");
  await expect(page).toHaveURL(/\/admin-page\/login/);
  await expect(page.getByRole("heading", { name: "Administrare DETALIA" })).toBeVisible();
});

test("sesiune intermediară pentru email care NU e în allowlist → respinsă", async ({
  browser,
  baseURL,
}) => {
  const { context, cleanup } = await contextWithPending(browser, baseURL, NOT_ADMIN_EMAIL);
  try {
    const page = await context.newPage();
    await page.goto("/admin-page/totp");
    await expect(page).toHaveURL(/\/admin-page\/login/);
  } finally {
    await cleanup();
  }
});

test("sesiune intermediară expirată → respinsă", async ({ browser, baseURL }) => {
  test.skip(!ADMIN_EMAIL, "ADMIN_EMAILS nu e setat în mediul de test");
  const { context, cleanup } = await contextWithPending(browser, baseURL, ADMIN_EMAIL!, {
    expired: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/admin-page/totp");
    await expect(page).toHaveURL(/\/admin-page\/login/);
  } finally {
    await cleanup();
  }
});

test("sesiune intermediară validă → ajunge la pasul de cod, dar NU în panou", async ({
  browser,
  baseURL,
}) => {
  test.skip(!ADMIN_EMAIL, "ADMIN_EMAILS nu e setat în mediul de test");
  const { context, cleanup } = await contextWithPending(browser, baseURL, ADMIN_EMAIL!);
  try {
    const page = await context.newPage();

    await page.goto("/admin-page/totp");
    await expect(page).toHaveURL(/\/admin-page\/totp$/);
    // Titlul diferă după cum TOTP-ul e deja activ pe mediul de test sau nu — ambele sunt pasul doi.
    await expect(
      page.getByRole("heading", { name: /Activează al doilea factor|Confirmă-ți identitatea/ }),
    ).toBeVisible();

    // MIEZUL: jumătatea de autentificare nu deschide nimic din panou.
    await page.goto("/admin-page");
    await expect(page).toHaveURL(/\/admin-page\/login/);
  } finally {
    await cleanup();
  }
});

test("magic link consumat NU mai duce direct în panou, ci la pasul de cod", async ({ browser }) => {
  test.skip(!ADMIN_EMAIL, "ADMIN_EMAILS nu e setat în mediul de test");
  const token = `e2e-admin-link-${Date.now()}`;
  await db.insert(adminLoginTokens).values({
    token: hashToken(token),
    email: ADMIN_EMAIL!,
    expires: new Date(Date.now() + 10 * 60_000),
  });

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`/admin-page/verify/confirm?token=${token}`);
    await expect(page).toHaveURL(/\/admin-page\/totp$/);

    // Un singur factor ⇒ zero acces. Regresia pe care o prinde testul ăsta e exact revenirea la
    // vechiul comportament (magic link → sesiune completă).
    await page.goto("/admin-page");
    await expect(page).toHaveURL(/\/admin-page\/login/);
  } finally {
    await context.close();
    await db.delete(adminLoginTokens).where(eq(adminLoginTokens.token, hashToken(token)));
    await db.delete(adminPendingSessions).where(eq(adminPendingSessions.email, ADMIN_EMAIL!));
  }
});

test("codul greșit nu deschide panoul și consumă din încercările sesiunii intermediare", async ({
  browser,
  baseURL,
}) => {
  test.skip(!ADMIN_EMAIL, "ADMIN_EMAILS nu e setat în mediul de test");
  // Testul are nevoie de un TOTP DEJA ACTIV, ca ecranul să fie cel de verificare, nu de înrolare.
  const existing = await db.select().from(adminTotp).where(eq(adminTotp.email, ADMIN_EMAIL!));
  test.skip(
    existing.length === 0 || !existing[0].enabled,
    "Nu există TOTP activ pe mediul de test — ecranul e cel de înrolare, nu de verificare",
  );

  const { context, cleanup } = await contextWithPending(browser, baseURL, ADMIN_EMAIL!);
  try {
    const page = await context.newPage();
    await page.goto("/admin-page/totp");

    await page.getByLabel("Cod de verificare").fill("000000");
    await page.getByRole("button", { name: "Confirmă" }).click();

    await expect(page.getByRole("alert")).toContainText("Cod invalid");
    await expect(page).toHaveURL(/\/admin-page\/totp$/);

    await page.goto("/admin-page");
    await expect(page).toHaveURL(/\/admin-page\/login/);
  } finally {
    await cleanup();
  }
});
