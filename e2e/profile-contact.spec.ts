import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { roles, users } from "../db/schema";
import { getSeed } from "./seed";

// Telefon/email opțional pe profil, vizibilitate opt-in per câmp (2026-07-16, cerere Edi). Proprietarul
// vede ÎNTOTDEAUNA datele lui; alt user vede DOAR dacă flagul de vizibilitate e explicit true.

const CONTACT_EMAIL = "e2e-profile-contact@detalia.test";
const CONTACT_NAME = "E2E Contact";

// User DEDICAT (nu `testerUserId` din seed) — bug găsit 2026-07-16: `profile-edit.spec.ts` retrimite
// ÎNTREG formularul „Detalii profil" pe ACELAȘI `testerUserId`, în paralel (worker diferit); submisia
// lui suprascria telefonul pe care acest test tocmai îl salvase (race reală, confirmată în DB: telefon
// rămânea `null` deși testul îl setase). Pattern identic cu `suspended.spec.ts`/`onboarding.spec.ts`.
async function ensureContactUser(): Promise<string> {
  let user = (await db.select({ id: users.id }).from(users).where(eq(users.email, CONTACT_EMAIL)).limit(1))[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          email: CONTACT_EMAIL,
          name: CONTACT_NAME,
          firstName: "E2E",
          lastName: "Contact",
          status: "ACTIVE",
          emailVerified: new Date(),
        })
        .returning({ id: users.id })
    )[0];
  }
  const existingRole = (await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, user.id)).limit(1))[0];
  if (!existingRole) {
    await db.insert(roles).values({ userId: user.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }
  return user.id;
}

test.describe.serial("Profil — telefon/email opțional, vizibilitate opt-in", () => {
  test.afterAll(async () => {
    const { authorUserId } = getSeed();
    await db.update(users).set({ phoneVisible: false, emailVisible: false }).where(eq(users.id, authorUserId));
  });

  test("proprietarul completează telefon + bifează vizibil → apare pe propriul profil public", async ({
    browser,
    baseURL,
  }) => {
    const userId = await ensureContactUser();
    const phone = `07${Date.now()}`.slice(0, 12);

    const url = new URL(baseURL ?? "http://localhost:3000");
    const secure = url.protocol === "https:";
    const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const maxAgeSeconds = 30 * 86_400;
    const sessionToken = await encode({
      secret: process.env.AUTH_SECRET!,
      salt: cookieName,
      maxAge: maxAgeSeconds,
      token: { sub: userId, id: userId, status: "ACTIVE", name: CONTACT_NAME, email: CONTACT_EMAIL },
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

      await page.goto("/profile/edit");
      await page.getByLabel(/^Telefon/).fill(phone);
      await page.getByLabel("Vizibil altor useri").first().check();
      await page.getByRole("button", { name: "Salvează profilul" }).click();
      await expect(page.getByRole("status")).toHaveText("Profilul a fost actualizat.");

      // Telefon/email nu mai stau direct în antet (2026-07-16) — grupate în modalul „Date de contact",
      // ca să nu împingă butonul „Editează profil" la fiecare câmp activat.
      await page.goto(`/profile/${userId}`);
      await page.getByRole("button", { name: "Date de contact" }).click();
      await expect(page.getByRole("link", { name: new RegExp(phone) })).toBeVisible();
    } finally {
      await context.close();
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  test("vizitator NU vede telefonul altui user dacă acesta NU l-a făcut vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    await db
      .update(users)
      .set({ phone: "0722999888", phoneVisible: false })
      .where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: /0722999888/ })).toHaveCount(0);
  });

  test("vizitator VEDE telefonul altui user dacă acesta l-a făcut explicit vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    await db
      .update(users)
      .set({ phone: "0722999888", phoneVisible: true })
      .where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await page.getByRole("button", { name: "Date de contact" }).click();
    await expect(page.getByRole("link", { name: /0722999888/ })).toBeVisible();
  });

  test("vizitator NU vede emailul altui user dacă acesta NU l-a făcut vizibil (implicit privat)", async ({
    page,
  }) => {
    const { authorUserId } = getSeed();
    const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, authorUserId));
    await db.update(users).set({ emailVisible: false }).where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await expect(page.getByRole("link", { name: new RegExp(author.email) })).toHaveCount(0);
  });

  test("vizitator VEDE emailul altui user dacă acesta l-a făcut explicit vizibil", async ({ page }) => {
    const { authorUserId } = getSeed();
    const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, authorUserId));
    await db.update(users).set({ emailVisible: true }).where(eq(users.id, authorUserId));

    await page.goto(`/profile/${authorUserId}`);
    await page.getByRole("button", { name: "Date de contact" }).click();
    await expect(page.getByRole("link", { name: new RegExp(author.email) })).toBeVisible();
  });
});
