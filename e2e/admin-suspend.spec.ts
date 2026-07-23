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

    const row = page.getByRole("row").filter({ hasText: TARGET_EMAIL });
    await expect(row).toBeVisible();

    // Suspendă — rândul trebuie să arate badge-ul SUSPENDED, iar butonul devine "Reactivează".
    await row.getByRole("button", { name: "Suspendă" }).click();
    await expect(row.getByText("SUSPENDED")).toBeVisible();

    let dbStatus = (
      await db.select({ status: users.status }).from(users).where(eq(users.id, targetUserId)).limit(1)
    )[0]?.status;
    expect(dbStatus).toBe("SUSPENDED");

    // Reactivează — badge-ul dispare, butonul revine la "Suspendă".
    await row.getByRole("button", { name: "Reactivează" }).click();
    await expect(row.getByText("SUSPENDED")).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Suspendă" })).toBeVisible();

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
