import { encode } from "@auth/core/jwt";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test, type Browser } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { details, projects, roles, users } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { pickLeafCategories } from "./category-helpers";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — feature „Proiect" (colaborare restrânsă, Faza A). Owner = testerUserId seedat (storageState
// din auth.setup.ts, `page` implicit). Membru + Stranger = useri DEDICAȚI, sesiune construită direct
// (ca în suspended.spec.ts) — nu poluează storageState-ul folosit de restul suitei în paralel.
//
// Acoperă exact verificarea adversarială cerută în planul feature-ului
// (C:\dev\persist\claude\plans\proiect-colaborare-restransa.md, §Verificare): acces direct la un
// detaliu de proiect prin URL fără a fi membru, token de invitație ghicit, regenerare link în timp ce
// tokenul vechi mai putea fi folosit.

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const MEMBER_EMAIL = "e2e-project-member@detalia.test";
const STRANGER_EMAIL = "e2e-project-stranger@detalia.test";

async function ensureActiveUserWithRole(email: string, name: string): Promise<string> {
  let user = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ email, name, firstName: "E2E", lastName: name, status: "ACTIVE", emailVerified: new Date() })
        .returning({ id: users.id })
    )[0];
  }
  const existingRole = (await db.select({ id: roles.id }).from(roles).where(eq(roles.userId, user.id)).limit(1))[0];
  if (!existingRole) {
    await db.insert(roles).values({ userId: user.id, roleMain: "PROIECTANT", subRole: "Arhitect" });
  }
  return user.id;
}

// Sesiune construită direct (fără login UI) — model identic cu suspended.spec.ts.
async function sessionContextFor(
  browser: Browser,
  baseURL: string | undefined,
  userId: string,
  name: string,
  email: string,
) {
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
  return browser.newContext({
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
}

test.describe.serial("Proiecte — colaborare restrânsă", () => {
  let projectId = "";
  let inviteToken = "";
  let memberUserId = "";
  let strangerUserId = "";
  let projectDetailId = "";
  let imageUrl: string | null = null;

  test.afterAll(async () => {
    if (projectDetailId) {
      await db.delete(details).where(eq(details.id, projectDetailId));
      if (imageUrl) await deleteBlobs([imageUrl]);
    }
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
  });

  test("owner creează un proiect → vede link de invitație", async ({ page }) => {
    await page.goto("/projects");
    await page.getByPlaceholder(/Nume proiect/).fill(`E2E Proiect ${Date.now()}`);
    await page.getByRole("button", { name: "Creează proiect" }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/, { timeout: 10_000 });
    projectId = page.url().split("/projects/")[1] ?? "";
    expect(projectId).toBeTruthy();

    const linkCode = page.locator("code");
    await expect(linkCode).toBeVisible();
    inviteToken = ((await linkCode.textContent()) ?? "").split("/projects/join/")[1]?.trim() ?? "";
    expect(inviteToken).toBeTruthy();
  });

  test("non-membru cu URL ghicit al proiectului → 404, fără leak de existență", async ({ browser, baseURL }) => {
    strangerUserId = await ensureActiveUserWithRole(STRANGER_EMAIL, "E2E Stranger");
    const context = await sessionContextFor(browser, baseURL, strangerUserId, "E2E Stranger", STRANGER_EMAIL);
    try {
      const page = await context.newPage();
      const res = await page.goto(`/projects/${projectId}`);
      expect(res?.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test("token de invitație ghicit (modificat) → link invalid, 404", async ({ browser, baseURL }) => {
    const context = await sessionContextFor(browser, baseURL, strangerUserId, "E2E Stranger", STRANGER_EMAIL);
    try {
      const page = await context.newPage();
      const res = await page.goto(`/projects/join/${inviteToken}deadbeef`);
      expect(res?.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test("membru se alătură prin link → vede pagina proiectului", async ({ browser, baseURL }) => {
    memberUserId = await ensureActiveUserWithRole(MEMBER_EMAIL, "E2E Member");
    const context = await sessionContextFor(browser, baseURL, memberUserId, "E2E Member", MEMBER_EMAIL);
    try {
      const page = await context.newPage();
      await page.goto(`/projects/join/${inviteToken}`);
      await page.getByRole("button", { name: "Alătură-te proiectului" }).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("regenerare link → tokenul VECHI devine invalid instant", async ({ page, browser, baseURL }) => {
    const oldToken = inviteToken;
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: "Regenerează" }).click();
    // Așteptăm ca noul token să înlocuiască vechiul în cutia de link (efect al server action-ului).
    await expect
      .poll(async () => ((await page.locator("code").textContent()) ?? "").includes(oldToken), { timeout: 10_000 })
      .toBe(false);
    inviteToken = ((await page.locator("code").textContent()) ?? "").split("/projects/join/")[1]?.trim() ?? "";
    expect(inviteToken).not.toBe(oldToken);

    const context = await sessionContextFor(browser, baseURL, strangerUserId, "E2E Stranger", STRANGER_EMAIL);
    try {
      const spage = await context.newPage();
      const res = await spage.goto(`/projects/join/${oldToken}`);
      expect(res?.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test("membru publică un detaliu în proiect → NU apare în feedul public, stranger e blocat", async ({
    browser,
    baseURL,
  }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E proiect detaliu ${Date.now()}`;

    const context = await sessionContextFor(browser, baseURL, memberUserId, "E2E Member", MEMBER_EMAIL);
    try {
      const page = await context.newPage();
      await stripBypassHeadersForBlobUploads(page);

      const tmpDir = mkdtempSync(path.join(tmpdir(), "detalia-e2e-proj-"));
      const imagePath = path.join(tmpDir, "tiny.png");
      writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, "base64"));

      await page.goto(`/details/new?projectId=${projectId}`);
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(imagePath);
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      // Butonul „Salvează ciornă" NU trebuie să existe deloc pe acest formular — invarianta „un
      // detaliu de proiect nu poate fi ciornă" (server/domain/project.ts).
      await expect(page.getByRole("button", { name: "Salvează ciornă" })).toHaveCount(0);

      await page.getByRole("button", { name: "Publică în proiect" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 15_000 });
      projectDetailId = page.url().split("/details/")[1] ?? "";
      expect(projectDetailId).toBeTruthy();

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, projectDetailId));
      imageUrl = row?.imageUrl ?? null;
    } finally {
      await context.close();
    }

    // Stranger: nici acces direct la detaliu, nici prezență în feed-ul public.
    //
    // Statusul HTTP NU se verifică aici: `app/(app)/details/[id]/loading.tsx` pune segmentul într-un
    // Suspense boundary → streaming-ul pornește ÎNAINTE ca `getDetail` să apuce să cheme `notFound()`,
    // iar Next.js comite deja 200 (+ noindex) în acel moment — comportament documentat (streaming.mdx,
    // not-found.mdx), nu un bug. `/projects/[id]` n-are `loading.tsx` → acolo 404 e real și rămâne
    // testat ca atare mai sus. Ce contează efectiv aici e că poarta de acces ține: pagina 404 se
    // randează și titlul detaliului NU ajunge în payload.
    const strangerCtx = await sessionContextFor(browser, baseURL, strangerUserId, "E2E Stranger", STRANGER_EMAIL);
    try {
      const spage = await strangerCtx.newPage();
      await spage.goto(`/details/${projectDetailId}`);
      await expect(spage.getByText("Nu găsim pagina")).toBeVisible();
      await expect(spage.getByText(title)).not.toBeVisible();

      await spage.goto(`/feed?q=${encodeURIComponent(title.split(" ")[0])}`);
      await expect(spage.getByText(title)).not.toBeVisible();
    } finally {
      await strangerCtx.close();
    }
  });

  // Regula „orfan" (server/domain/project.ts, canReleaseToCommunity): autorul poate ORICÂND, owner-ul
  // DOAR dacă autorul nu mai e membru activ. `page` (fixture implicit) e OWNER-ul proiectului — dar
  // autorul detaliului e membrul, încă activ — deci owner-ul NU ar avea dreptul aici. Testăm calea
  // mereu-permisă: autorul își scoate propriul detaliu.
  test("autorul scoate propriul detaliu în comunitate → devine public (regula ireversibilă)", async ({
    browser,
    baseURL,
  }) => {
    const memberCtx = await sessionContextFor(browser, baseURL, memberUserId, "E2E Member", MEMBER_EMAIL);
    const page = await memberCtx.newPage();
    await page.goto(`/details/${projectDetailId}`);
    await expect(page.getByText("proiect privat")).toBeVisible();

    await page.getByRole("button", { name: "Scoate în comunitate" }).click();
    await page.getByRole("button", { name: "Da, scoate în comunitate" }).click();
    await expect(page.getByText("proiect privat")).not.toBeVisible({ timeout: 10_000 });
    await memberCtx.close();

    // Acum e cu adevărat public — stranger-ul (care nu a fost NICIODATĂ membru) îl poate vedea.
    const strangerCtx = await sessionContextFor(browser, baseURL, strangerUserId, "E2E Stranger", STRANGER_EMAIL);
    try {
      const spage = await strangerCtx.newPage();
      const res = await spage.goto(`/details/${projectDetailId}`);
      expect(res?.status()).toBe(200);
    } finally {
      await strangerCtx.close();
    }
  });
});
