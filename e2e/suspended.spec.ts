import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { roles, users } from "../db/schema";
import { getSeed } from "./seed";

// SEC-04 / SEC-S1 (docs/SECURITATE.md): un cont SUSPENDAT cu sesiune JWT vie (status stale în token)
// nu trebuie să poată executa NICIO mutație — prima încercare trebuie să-l delogheze real
// (`requireActiveUserId` → signOut). User DEDICAT (nu `testerUserId` din seed) ca să nu invalideze
// storageState-ul folosit de authed.spec.ts / sketch.spec.ts în paralel.

const SUSPENDED_EMAIL = "e2e-suspended@detalia.test";
const SUSPENDED_NAME = "E2E Suspended";

async function ensureSuspendedUser(): Promise<string> {
  let user = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, SUSPENDED_EMAIL)).limit(1)
  )[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          email: SUSPENDED_EMAIL,
          name: SUSPENDED_NAME,
          firstName: "E2E",
          lastName: "Suspended",
          status: "SUSPENDED",
          emailVerified: new Date(),
        })
        .returning({ id: users.id })
    )[0];
  } else {
    await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, user.id));
  }

  // Fără rol declarat, orice pagină protejată redirectează la /onboarding ÎNAINTE să apuce să
  // verifice suspendarea — testul ar pica mereu pe asta, nu pe ce testează de fapt (bug real, prima
  // rulare reală a testului l-a prins: redirect la /onboarding în loc de pagina detaliului).
  const existingRole = (await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, user.id)).limit(1))[0];
  if (!existingRole) {
    await db.insert(roles).values({ userId: user.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }

  return user.id;
}

test("cont SUSPENDAT cu token JWT viu → mutație blocată + delogare reală", async ({ browser, baseURL }) => {
  const userId = await ensureSuspendedUser();
  const { detailId } = getSeed();

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const maxAgeSeconds = 30 * 86_400;

  // Token construit ca la login real, dar cu `status: "ACTIVE"` (STALE) — exact scenariul SEC-04:
  // JWT-ul nu știe încă de suspendare, doar DB-ul o știe. Verificarea proaspătă trebuie s-o prindă.
  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sub: userId, id: userId, status: "ACTIVE", name: SUSPENDED_NAME, email: SUSPENDED_EMAIL },
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

    // Citirea trece (token stale = ACTIVE) — asta e comportamentul AȘTEPTAT, nu bug.
    await page.goto(`/details/${detailId}`);
    await expect(page).toHaveURL(new RegExp(`/details/${detailId}`));

    // Prima MUTAȚIE (comentariu) trebuie blocată + delogare reală → redirect la /login.
    const body = `E2E suspended ${Date.now()}`;
    await page.getByPlaceholder(/Adaugă la dezbatere/).fill(body);
    await page.getByRole("button", { name: "Comentează" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(body)).not.toBeVisible();

    // Cookie-ul de sesiune trebuie șters (signOut real, nu doar redirect) — „back" nu trebuie să revină la citire.
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === cookieName);
    expect(sessionCookie).toBeUndefined();
  } finally {
    await context.close();
    await db.delete(users).where(eq(users.id, userId));
  }
});
