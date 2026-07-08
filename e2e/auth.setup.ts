import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { encode } from "@auth/core/jwt";
import { test as setup, expect } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { categories, detailCategories, details, roles, users } from "../db/schema";
import { pickLeafCategories } from "./category-helpers";

// Setup AUTHED — seedează direct în DB un user ACTIVE cu rol declarat, apoi emite un cookie de sesiune
// JWT valid (strategie `session.strategy = "jwt"`, vezi lib/auth.ts) prin `encode()` din `@auth/core/jwt`
// — ACELAȘI mecanism folosit de Auth.js la login real, doar pre-populat. Tabelul `sessions` NU se mai
// scrie (sesiunea trăiește în cookie, nu în DB) de la migrarea 2026-07-02. Salvează storageState (cookie)
// + seed.json (id detaliu țintă).

const AUTH_DIR = path.resolve(__dirname, ".auth");
const STATE_PATH = path.join(AUTH_DIR, "state.json");
const SEED_PATH = path.join(AUTH_DIR, "seed.json");

const TEST_EMAIL = "e2e-tester@detalia.test";
const TEST_NAME = "E2E Tester";
// Autor SEPARAT de userul de sesiune — CANNOT_VALIDATE_OWN blochează Aprob/Dezaprob pe propriul
// conținut, deci detaliul țintă al testelor de validare nu poate fi autorat de userul care validează.
const AUTHOR_EMAIL = "e2e-author@detalia.test";
const AUTHOR_NAME = "E2E Author";
const DETAIL_TITLE = "E2E — detaliu de test (validare)";
const SESSION_DAYS = 30;

setup("seed user + rol + sesiune + detaliu și salvează storageState", async () => {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  expect(
    process.env.DATABASE_URL,
    "DATABASE_URL lipsește din .env.e2e — necesar pt seed-ul de sesiune (vezi e2e/README.md)",
  ).toBeTruthy();
  expect(
    process.env.AUTH_SECRET,
    "AUTH_SECRET lipsește din .env.e2e — necesar pt semnarea cookie-ului JWT (aceeași valoare ca pe preview/dev, din Vercel → Environment Variables)",
  ).toBeTruthy();

  // 1) Categorie țintă — frunză DIRECT vizibilă (copil de secțiune, NU ascunsă sub un capitol
  // colapsat, ex. „Șarpantă" sub Acoperiș) — altfel testele care deschid dropdown-ul de categorii
  // și interacționează cu bifa detaliului seedat pică silențios (nu găsesc/nu pot debifa o frunză
  // nerandată în DOM cât timp capitolul ei e colapsat). Bug real găsit 2026-07-07 în
  // `detail-edit.spec.ts` „golirea tuturor categoriilor" — vezi CHANGELOG.
  let category: { id: string } | undefined;
  try {
    [category] = await pickLeafCategories(1);
  } catch {
    category = undefined;
  }
  if (!category) {
    category = (
      await db
        .insert(categories)
        .values({ name: "Test", slug: "e2e-test" })
        .returning({ id: categories.id })
    )[0];
  }

  // 2) User de test (upsert pe email).
  let user = (await db.select({ id: users.id }).from(users).where(eq(users.email, TEST_EMAIL)).limit(1))[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          email: TEST_EMAIL,
          name: TEST_NAME,
          firstName: "E2E",
          lastName: "Tester",
          status: "ACTIVE",
          emailVerified: new Date(),
        })
        .returning({ id: users.id })
    )[0];
  }

  // 3) Rol declarat (un singur rol/user — unique pe userId) → userul nu e împins spre /onboarding.
  const existingRole = (await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, user.id)).limit(1))[0];
  if (!existingRole) {
    await db.insert(roles).values({ userId: user.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }

  // 3b) Autor separat (nu se loghează, doar deține detaliul-țintă) — vezi nota CANNOT_VALIDATE_OWN de mai sus.
  let author = (await db.select({ id: users.id }).from(users).where(eq(users.email, AUTHOR_EMAIL)).limit(1))[0];
  if (!author) {
    author = (
      await db
        .insert(users)
        .values({
          email: AUTHOR_EMAIL,
          name: AUTHOR_NAME,
          firstName: "E2E",
          lastName: "Author",
          status: "ACTIVE",
          emailVerified: new Date(),
        })
        .returning({ id: users.id })
    )[0];
  }
  const existingAuthorRole = (
    await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, author.id)).limit(1)
  )[0];
  if (!existingAuthorRole) {
    await db.insert(roles).values({ userId: author.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }

  // 4) Cookie de sesiune JWT — construit exact ca token-ul produs de callback-ul `jwt()` din lib/auth.ts
  // la login real (token.id + token.status), apoi criptat cu `encode()` (același AUTH_SECRET + salt =
  // numele cookie-ului, pe care Auth.js îl folosește la `decode()` server-side).
  const maxAgeSeconds = SESSION_DAYS * 86_400;
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);

  // 5) Detaliu țintă pentru testele de validare (reutilizat între rulări), autorat de `author`, NU de `user`.
  let detail = (
    await db.select({ id: details.id }).from(details).where(eq(details.authorId, author.id)).limit(1)
  )[0];
  if (!detail) {
    detail = (
      await db
        .insert(details)
        .values({
          title: DETAIL_TITLE,
          description: "Detaliu seedat de suita E2E pentru testarea validării pe roluri.",
          authorId: author.id,
          // Host care MATCHEAZĂ remotePatterns din next.config (altfel next/image dă 500). Fișierul nu
          // există → imaginea apare ruptă, dar pagina randează (suficient pt testele de validare).
          imageUrl: "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png",
          status: "PUBLISHED",
        })
        .returning({ id: details.id })
    )[0];
    await db.insert(detailCategories).values({ detailId: detail.id, categoryId: category.id });
  } else {
    // Detaliul e reutilizat dintr-o rulare anterioară — dar `category` de mai sus a fost ales ACUM,
    // via `pickLeafCategories` (nedeterminist), și poate fi diferit de categoria legată efectiv atunci.
    // Citim înapoi legătura REALĂ ca `seed.json.categoryId` să reflecte adevărul din DB, nu o alegere nouă.
    const existingLink = (
      await db
        .select({ categoryId: detailCategories.categoryId })
        .from(detailCategories)
        .where(eq(detailCategories.detailId, detail.id))
        .limit(1)
    )[0];
    if (existingLink) category = { id: existingLink.categoryId };
  }

  // 6) Cookie de sesiune Auth.js. Numele/securizarea depind de protocol (https → prefix `__Secure-`).
  const url = new URL(baseURL);
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";

  // `salt` = numele cookie-ului (așa derivează Auth.js cheia de criptare la decode, vezi
  // @auth/core/lib/utils/session.js). Payload-ul mimează exact ce pune callback-ul `jwt()` la login real.
  const sessionToken = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: maxAgeSeconds,
    token: { sub: user.id, id: user.id, status: "ACTIVE", name: TEST_NAME, email: TEST_EMAIL },
  });

  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        cookies: [
          {
            name: cookieName,
            value: sessionToken,
            domain: url.hostname,
            path: "/",
            expires: Math.floor(expires.getTime() / 1000),
            httpOnly: true,
            secure,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    SEED_PATH,
    JSON.stringify(
      {
        detailId: detail.id,
        detailTitle: DETAIL_TITLE,
        testerUserId: user.id,
        authorUserId: author.id,
        categoryId: category.id,
      },
      null,
      2,
    ),
  );
});
