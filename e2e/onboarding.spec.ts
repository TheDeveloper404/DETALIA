import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { roles, users } from "../db/schema";

// Onboarding — netestat până acum. User DEDICAT fără rol (nu `testerUserId` din seed, care are deja rol
// declarat) → cookie JWT propriu, ca în suspended.spec.ts. Verifică: /onboarding e accesibil DOAR fără rol,
// formularul completat declară rolul + redirect la /feed, revizitarea /onboarding după aceea redirectează
// direct la /feed (markerul de „onboarding complet" = existența rolului).

const EMAIL = "e2e-onboarding@detalia.test";
const NAME = "E2E Onboarding";

// Email/user PROPRIU per test (nu shared) — testele din acest fișier NU sunt `describe.serial` (rulează
// în paralel, pe workeri diferiți). Două teste pe ACELAȘI user ar risca o race reală: ambele apelează
// `ensureRoleLessUser`, unul termină onboarding-ul primul, celălalt lovește „Ai deja un rol declarat"
// (bug găsit 2026-07-16 — testul nou de restructurare roluri refolosea greșit EMAIL-ul primului test).
async function ensureRoleLessUser(email: string, name: string): Promise<string> {
  let user = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ email, name, status: "ACTIVE", emailVerified: new Date() })
        .returning({ id: users.id })
    )[0];
  } else {
    // Idempotent între rulări: userul poate fi rămas cu rol dintr-o rulare anterioară eșuată.
    await db.delete(roles).where(eq(roles.userId, user.id));
  }
  return user.id;
}

test("onboarding: fără rol → formular → declară rolul → /feed; revizitare → redirect direct la /feed", async ({
  browser,
  baseURL,
}) => {
  const userId = await ensureRoleLessUser(EMAIL, NAME);

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const maxAgeSeconds = 30 * 86_400;

  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sub: userId, id: userId, status: "ACTIVE", name: NAME, email: EMAIL },
  });

  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: cookieName,
          value: sessionToken,
          domain: url.hostname,
          path: "/",
          expires: Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000),
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

    await page.goto("/onboarding");
    await expect(page).toHaveURL("/onboarding");

    await page.locator("#dt-first").fill("E2E");
    await page.locator("#dt-last").fill("Onboarding");
    await page.locator("#dt-rol").selectOption("PROIECTANT");
    await page.locator("#dt-subrol").selectOption("Arhitect");

    await page.getByRole("button", { name: "Continuă în feed" }).click();

    await expect(page).toHaveURL(/\/feed/, { timeout: 15_000 });

    const [role] = await db.select().from(roles).where(eq(roles.userId, userId));
    expect(role?.roleMain).toBe("PROIECTANT");
    expect(role?.subRole).toBe("Arhitect");

    // Markerul de „onboarding complet": revizitarea /onboarding NU mai arată formularul.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/feed/);
  } finally {
    await context.close();
    await db.delete(users).where(eq(users.id, userId));
  }
});

// Restructurare roluri (2026-07-16, cerere Edi): subrolurile noi de Execuție sunt selectabile, cele
// mutate la Rol adițional nu mai apar la Execuție.
test("onboarding: subrol nou de Execuție (Tâmplar mobilă) e selectabil și se salvează", async ({
  browser,
  baseURL,
}) => {
  const email = "e2e-onboarding-roluri@detalia.test";
  const name = "E2E Roluri";
  const userId = await ensureRoleLessUser(email, name);

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const maxAgeSeconds = 30 * 86_400;

  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sub: userId, id: userId, status: "ACTIVE", name, email },
  });

  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: cookieName,
          value: sessionToken,
          domain: url.hostname,
          path: "/",
          expires: Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000),
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
    await page.goto("/onboarding");

    await page.locator("#dt-first").fill("E2E");
    await page.locator("#dt-last").fill("Roluri");
    await page.locator("#dt-rol").selectOption("EXECUTANT");

    // Subrolurile mutate la Rol adițional NU mai trebuie să apară la Execuție.
    const subrolOptions = await page.locator("#dt-subrol option").allTextContents();
    expect(subrolOptions).not.toContain("Diriginte de șantier");
    expect(subrolOptions).not.toContain("RTE");
    expect(subrolOptions).toContain("Tâmplar mobilă");

    await page.locator("#dt-subrol").selectOption("Tâmplar mobilă");
    await page.getByRole("button", { name: "Continuă în feed" }).click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 15_000 });

    const [role] = await db.select().from(roles).where(eq(roles.userId, userId));
    expect(role?.roleMain).toBe("EXECUTANT");
    expect(role?.subRole).toBe("Tâmplar mobilă");
  } finally {
    await context.close();
    await db.delete(users).where(eq(users.id, userId));
  }
});
