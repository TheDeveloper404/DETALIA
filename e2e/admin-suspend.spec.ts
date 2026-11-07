import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { adminSessions, roles, users } from "../db/schema";
import { hashToken } from "../lib/admin-auth";

// E2E — suspendare/reactivare de admin (SEC-001, moderare reversibilă adăugată 2026-07-13).
// Sesiunea de admin e injectată direct în DB + cookie (ca în admin-access.spec.ts) cu emailul REAL
// din `ADMIN_EMAILS` (env local/CI) — nu putem hardcoda un email, allowlist-ul e specific mediului.
// Dacă `ADMIN_EMAILS` nu e setat în mediul de test, testul se sare (nu poate exista o sesiune validă).

const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
const COOKIE = "detalia-admin-session";
const TARGET_EMAIL = "e2e-suspend-target@detalia.test";
const TARGET_NAME = "E2E Suspend Target";

async function ensureTargetUser(): Promise<string> {
  let user = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, TARGET_EMAIL)).limit(1)
  )[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          email: TARGET_EMAIL,
          name: TARGET_NAME,
          firstName: "E2E",
          lastName: "Target",
          status: "ACTIVE",
          emailVerified: new Date(),
        })
        .returning({ id: users.id })
    )[0];
  } else {
    await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, user.id));
  }

  const existingRole = (
    await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, user.id)).limit(1)
  )[0];
  if (!existingRole) {
    await db.insert(roles).values({ userId: user.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }

  return user.id;
}

test.skip(!ADMIN_EMAIL, "ADMIN_EMAILS nu e setat în mediul de test — nu pot construi o sesiune admin validă");

test("admin suspendă și reactivează un cont din /admin-page", async ({ browser, baseURL }) => {
  const targetUserId = await ensureTargetUser();

  const token = `e2e-admin-suspend-${Date.now()}`;
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(adminSessions).values({ token: hashToken(token), email: ADMIN_EMAIL!, expires });

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
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/admin-page");
    await expect(page.getByRole("heading", { name: "Administrare" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Total useri/ })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: TARGET_EMAIL });

    // Filtrele raman in link si ascund/arata randul dupa rol (targetul e PROIECTANT, sub-rol Arhitect).
    await page.getByRole("searchbox", { name: "Caută" }).fill(TARGET_EMAIL);
    await expect(row).toBeVisible();
    await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption("NONE");
    await expect(row).toBeHidden();
    await expect(page).toHaveURL(/rol=NONE/);
    // Cautarea (aici un email) nu intra in link: URL-ul ajunge in PostHog.
    expect(page.url()).not.toContain("e2e-suspend-target");
    await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption("PROIECTANT");
    await expect(row).toBeVisible();

    // Regula (decizia 2026-11-07): actiunile pe cont stau in fisa userului, panou lateral deschis din rand;
    // butonul e acelasi UserStatusButton, fara actiune server noua.
    await row.click();
    const panel = page.getByRole("dialog", { name: "Fișa userului E2E Target" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Proiectare · Arhitect")).toBeVisible();

    // Suspendă — rândul arată „Suspendat”, iar butonul din fișă devine "Reactivează".
    await panel.getByRole("button", { name: "Suspendă" }).click();
    await expect(row.getByText("Suspendat", { exact: true })).toBeVisible();

    let dbStatus = (
      await db.select({ status: users.status }).from(users).where(eq(users.id, targetUserId)).limit(1)
    )[0]?.status;
    expect(dbStatus).toBe("SUSPENDED");

    // Reactivează — rândul revine la „Activ”, butonul din fișă revine la "Suspendă".
    await panel.getByRole("button", { name: "Reactivează" }).click();
    await expect(row.getByText("Activ", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Suspendă" })).toBeVisible();

    dbStatus = (
      await db.select({ status: users.status }).from(users).where(eq(users.id, targetUserId)).limit(1)
    )[0]?.status;
    expect(dbStatus).toBe("ACTIVE");
  } finally {
    await context.close();
    await db.delete(adminSessions).where(eq(adminSessions.token, hashToken(token)));
    await db.delete(users).where(eq(users.id, targetUserId));
  }
});
