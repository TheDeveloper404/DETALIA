import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { roles, users, sessions } from "../db/schema";
import { SESSION_MAX_AGE_SECONDS } from "../lib/session-config";
import { getSeed } from "./seed";

// SEC-04 / SEC-002 (docs/SECURITATE.md, decizie de produs 2026-08-09): un cont SUSPENDAT cu sesiune JWT
// vie (status stale în token) nu trebuie să mai aibă NICIUN acces la zona protejată — nici măcar citire.
// `proxy.ts` verifică status proaspăt din DB pe fiecare request protejat → prima vizită (nu doar prima
// mutație) delogează real. User DEDICAT (nu `testerUserId` din seed) ca să nu invalideze storageState-ul
// folosit de authed.spec.ts / sketch.spec.ts în paralel.

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

test("cont SUSPENDAT cu token JWT viu → acces blocat din prima vizită + delogare reală", async ({ browser, baseURL }) => {
  const userId = await ensureSuspendedUser();
  const { detailId } = getSeed();

  const url = new URL(baseURL ?? "http://localhost:3000");
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const maxAgeSeconds = SESSION_MAX_AGE_SECONDS;

  // Token construit ca la login real, dar cu `status: "ACTIVE"` (STALE) — exact scenariul SEC-04:
  // JWT-ul nu știe încă de suspendare, doar DB-ul o știe. Verificarea proaspătă trebuie s-o prindă.
  const sid = crypto.randomUUID();
  await db.insert(sessions).values({ sessionToken: sid, userId: userId, expires: new Date(Date.now() + maxAgeSeconds * 1000) });
  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sid, sub: userId, id: userId, status: "ACTIVE", name: SUSPENDED_NAME, email: SUSPENDED_EMAIL },
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

    // Prima vizită pe o rută protejată (chiar și CITIRE) trebuie blocată + delogare reală → redirect
    // la /login?error=AccessDenied. proxy.ts verifică status proaspăt din DB (SEC-002), nu tokenul stale.
    await page.goto(`/details/${detailId}`);
    await expect(page).toHaveURL(/\/login\?error=AccessDenied/);
    await expect(page.getByText(SUSPENDED_NAME)).not.toBeVisible();

    // Cookie-ul de sesiune s-a șters pe răspunsul proxy-ului (Set-Cookie Max-Age=0) — o a doua vizită
    // pe orice rută protejată trebuie tratată ca neautentificat (nu ca „stale, dar tot logat").
    await page.goto(`/details/${detailId}`);
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
    await db.delete(users).where(eq(users.id, userId));
  }
});

// Regula: "Stergerea unui sid afecteaza numai acea sesiune, inclusiv copiile cookie-ului ei; celelalte dispozitive raman conectate."
test("logout revoca si copia cookie-ului, dar pastreaza al doilea dispozitiv", async ({ browser, context, page, baseURL }) => {
  const url = new URL(baseURL!);
  const userId = crypto.randomUUID();
  const firstSid = crypto.randomUUID(), otherSid = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  await db.insert(users).values({ id: userId, email: `e2e-session-${userId}@detalia.test`, status: "ACTIVE" });
  await db.insert(sessions).values([
    { sessionToken: firstSid, userId, expires }, { sessionToken: otherSid, userId, expires },
  ]);
  const value = await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, maxAge: SESSION_MAX_AGE_SECONDS, token: { sub: userId, id: userId, sid: firstSid, status: "ACTIVE" } });
  await context.addCookies([{ name: cookieName, value, domain: url.hostname, path: "/", expires: expires.valueOf() / 1000, httpOnly: true, secure, sameSite: "Lax" }]);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding/);
  const copiedState = await context.storageState();
  const copied = await browser.newContext({ baseURL, storageState: copiedState });
  const other = await browser.newContext({ baseURL, storageState: copiedState });
  await other.addCookies([{ name: cookieName, value: await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, maxAge: SESSION_MAX_AGE_SECONDS, token: { sub: userId, id: userId, sid: otherSid, status: "ACTIVE" } }), domain: url.hostname, path: "/", expires: expires.valueOf() / 1000, httpOnly: true, secure, sameSite: "Lax" }]);
  try {
    const { csrfToken } = await (await context.request.get("/api/auth/csrf")).json();
    const response = await context.request.post("/api/auth/signout", { form: { csrfToken, callbackUrl: url.origin }, maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(await (await copied.request.get("/api/auth/session")).json()).toBeNull();
    expect((await (await other.request.get("/api/auth/session")).json()).user.id).toBe(userId);
    const copiedPage = await copied.newPage();
    await copiedPage.goto("/onboarding");
    await expect(copiedPage).toHaveURL(/\/login/);
  } finally {
    await copied.close();
    await other.close();
    await db.delete(users).where(eq(users.id, userId));
  }
});

// Regula: "Data din DB se stabileste o singura data si nu se prelungeste."
test("refresh-ul sesiunii nu prelungeste expirarea absoluta din registru", async ({ context, page, baseURL }) => {
  const url = new URL(baseURL!);
  const userId = crypto.randomUUID(), sid = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  await db.insert(users).values({ id: userId, email: `e2e-expiry-${userId}@detalia.test`, status: "ACTIVE" });
  await db.insert(sessions).values({ sessionToken: sid, userId, expires });
  const value = await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, maxAge: SESSION_MAX_AGE_SECONDS, token: { sub: userId, id: userId, sid, status: "ACTIVE" } });
  await context.addCookies([{ name: cookieName, value, domain: url.hostname, path: "/", expires: Date.now() / 1000 + SESSION_MAX_AGE_SECONDS, httpOnly: true, secure, sameSite: "Lax" }]);
  try {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding/);
    expect((await (await context.request.get("/api/auth/session")).json()).user.id).toBe(userId);
    const [row] = await db.select({ expires: sessions.expires }).from(sessions).where(eq(sessions.sessionToken, sid));
    expect(row.expires.valueOf()).toBe(expires.valueOf());
    await db.update(sessions).set({ expires: new Date(Date.now() - 1000) }).where(eq(sessions.sessionToken, sid));
    expect(await (await context.request.get("/api/auth/session")).json()).toBeNull();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
});
