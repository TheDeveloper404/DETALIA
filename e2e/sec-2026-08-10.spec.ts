import { eq } from "drizzle-orm";

import { expect, test, type Browser } from "@playwright/test";

import { db } from "../db";
import { details, projectMembers, projects, roles, sketches, users } from "../db/schema";
import { getSeed } from "./seed";

// E2E — audit de securitate 13 categorii, 2026-08-10 (SEC-001 + SEC-002). Owner = testerUserId seedat
// (autor al detaliului ȘI owner al proiectului, ca să poată și scoate detaliul în comunitate). Membru =
// user dedicat, sesiune construită direct (ca în projects.spec.ts) — nu poluează storageState-ul
// folosit de restul suitei în paralel. Setup prin insert direct în DB (proiect/membru/schițe), nu prin
// UI — flow-urile de join/publish/release sunt deja acoperite integral în projects.spec.ts; aici testăm
// STRICT cele două căi de citire reparate azi.

const MEMBER_EMAIL = "e2e-sec-audit-member@detalia.test";
const PLACEHOLDER_IMAGE = "https://e2e.public.blob.vercel-storage.com/e2e-placeholder.png";

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

async function sessionContextFor(browser: Browser, baseURL: string | undefined, userId: string, name: string, email: string) {
  const { encode } = await import("@auth/core/jwt");
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

test.describe.serial("Audit securitate 2026-08-10 — SEC-001 & SEC-002", () => {
  let ownerUserId = "";
  let memberUserId = "";
  let projectId = "";
  let detailId = "";
  let draftSketchId = "";
  let publishedSketchId = "";
  const detailTitle = `E2E SEC audit ${Date.now()}`;

  test.beforeAll(async () => {
    ownerUserId = getSeed().testerUserId;
    memberUserId = await ensureActiveUserWithRole(MEMBER_EMAIL, "SecAudit Member");

    const [project] = await db
      .insert(projects)
      .values({ ownerId: ownerUserId, name: "E2E SEC audit project", inviteToken: crypto.randomUUID() })
      .returning({ id: projects.id });
    projectId = project!.id;
    await db.insert(projectMembers).values({ projectId, userId: memberUserId });

    const [detail] = await db
      .insert(details)
      .values({ title: detailTitle, authorId: ownerUserId, imageUrl: PLACEHOLDER_IMAGE, status: "PUBLISHED", projectId })
      .returning({ id: details.id });
    detailId = detail!.id;

    // Ciorna membrului — pentru SEC-001 (leak pe „Ciornele mele" după eliminare din proiect).
    const [draft] = await db
      .insert(sketches)
      .values({ detailId, authorId: memberUserId, status: "DRAFT" })
      .returning({ id: sketches.id });
    draftSketchId = draft!.id;

    // Schița PUBLISHED a membrului — pentru SEC-002 (release publică doar conținutul autorului).
    const [published] = await db
      .insert(sketches)
      .values({
        detailId,
        authorId: memberUserId,
        status: "PUBLISHED",
        thumbnailUrl: PLACEHOLDER_IMAGE,
        acceptedAt: new Date(),
      })
      .returning({ id: sketches.id });
    publishedSketchId = published!.id;
  });

  test.afterAll(async () => {
    if (publishedSketchId) await db.delete(sketches).where(eq(sketches.id, publishedSketchId));
    if (draftSketchId) await db.delete(sketches).where(eq(sketches.id, draftSketchId));
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
  });

  test("SEC-001: membru eliminat din proiect nu-și mai vede ciorna cu titlul/imaginea detaliului privat", async ({
    browser,
    baseURL,
  }) => {
    const memberCtx = await sessionContextFor(browser, baseURL, memberUserId, "SecAudit Member", MEMBER_EMAIL);
    try {
      const page = await memberCtx.newPage();
      await page.goto("/sketches/drafts");
      await expect(page.getByText(detailTitle)).toBeVisible();

      // Eliminare (owner) — direct în DB, flow-ul de UI e acoperit deja în projects.spec.ts.
      await db.update(projectMembers).set({ removedAt: new Date() }).where(eq(projectMembers.userId, memberUserId));

      await page.reload();
      await expect(page.getByText(detailTitle)).not.toBeVisible();
    } finally {
      await memberCtx.close();
      // Repune membrul activ — SEC-002 rulează după, în același proiect.
      await db.update(projectMembers).set({ removedAt: null }).where(eq(projectMembers.userId, memberUserId));
    }
  });

  test("SEC-002: „Scoate în comunitate” nu publică schița altui membru", async ({ page, browser, baseURL }) => {
    // Teancul, ÎNAINTE de release: schița membrului e vizibilă owner-ului/autorului detaliului.
    await page.goto(`/details/${detailId}`);
    await expect(page.getByTestId(`sketch-tab-${publishedSketchId}`)).toBeVisible();

    await page.getByRole("button", { name: "Scoate în comunitate" }).click();
    await page.getByRole("button", { name: "Da, scoate în comunitate" }).click();
    await expect(page.getByText("proiect privat")).not.toBeVisible({ timeout: 10_000 });

    // Detaliul e acum public — dar schița membrului rămâne ascunsă (hiddenAfterRelease).
    const strangerCtx = await sessionContextFor(browser, baseURL, memberUserId, "SecAudit Member", MEMBER_EMAIL);
    try {
      const spage = await strangerCtx.newPage();
      const res = await spage.goto(`/details/${detailId}`);
      expect(res?.status()).toBe(200);
      await expect(spage.getByTestId(`sketch-tab-${publishedSketchId}`)).toHaveCount(0);

      // Teaser-ul public (fără cont) al schiței ascunse — nu trebuie să existe.
      await spage.context().clearCookies();
      const teaserRes = await spage.goto(`/s/${publishedSketchId}`);
      expect(teaserRes?.status()).not.toBe(200);
    } finally {
      await strangerCtx.close();
    }

    const [row] = await db
      .select({ hiddenAfterRelease: sketches.hiddenAfterRelease })
      .from(sketches)
      .where(eq(sketches.id, publishedSketchId));
    expect(row?.hiddenAfterRelease).toBe(true);
  });
});
