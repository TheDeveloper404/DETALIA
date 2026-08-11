import { eq } from "drizzle-orm";

import { expect, test, type Browser } from "@playwright/test";

import { db } from "../db";
import { comments, details, projectMembers, projects, roles, sketches, users, validations } from "../db/schema";
import { getSeed } from "./seed";

// E2E — audit de securitate 13 categorii, 2026-08-11, SEC-001: „Scoate în comunitate" trebuia să
// ascundă (hiddenAfterRelease) și comentariile/validările ALTOR membri decât autorul detaliului, nu
// doar schițele lor (regulă deja existentă din SEC-002/2026-08-10, extinsă azi la comentarii+validări
// — atât pe ținta DETAIL cât și pe ținta SKETCH, pentru orice schiță a detaliului). Owner = testerUserId
// seedat (autor al detaliului ȘI owner al proiectului). Setup prin insert direct în DB — flow-ul de
// join/publish/release e deja acoperit integral în projects.spec.ts.

const MEMBER_EMAIL = "e2e-sec-audit-2026-08-11-member@detalia.test";
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

test.describe.serial("Audit securitate 2026-08-11 — SEC-001", () => {
  let ownerUserId = "";
  let memberUserId = "";
  let projectId = "";
  let detailId = "";
  let memberSketchId = "";
  let detailCommentId = "";
  let sketchCommentId = "";
  const detailTitle = `E2E SEC-001 audit ${Date.now()}`;
  const detailCommentBody = "Comentariul privat al membrului pe detaliu — nu trebuie să devină public";
  const sketchCommentBody = "Comentariul privat al membrului pe propria schiță — nu trebuie să devină public";

  test.beforeAll(async () => {
    ownerUserId = getSeed().testerUserId;
    memberUserId = await ensureActiveUserWithRole(MEMBER_EMAIL, "SecAudit0811 Member");

    const [project] = await db
      .insert(projects)
      .values({ ownerId: ownerUserId, name: "E2E SEC-001 audit project", inviteToken: crypto.randomUUID() })
      .returning({ id: projects.id });
    projectId = project!.id;
    await db.insert(projectMembers).values({ projectId, userId: memberUserId });

    const [detail] = await db
      .insert(details)
      .values({ title: detailTitle, authorId: ownerUserId, imageUrl: PLACEHOLDER_IMAGE, status: "PUBLISHED", projectId })
      .returning({ id: details.id });
    detailId = detail!.id;

    const [sketch] = await db
      .insert(sketches)
      .values({
        detailId,
        authorId: memberUserId,
        status: "PUBLISHED",
        thumbnailUrl: PLACEHOLDER_IMAGE,
        acceptedAt: new Date(),
      })
      .returning({ id: sketches.id });
    memberSketchId = sketch!.id;

    // Comentariu + validare ale membrului, pe ținta DETAIL direct.
    const [detailComment] = await db
      .insert(comments)
      .values({ targetType: "DETAIL", targetId: detailId, authorId: memberUserId, body: detailCommentBody })
      .returning({ id: comments.id });
    detailCommentId = detailComment!.id;
    await db.insert(validations).values({ userId: memberUserId, targetType: "DETAIL", targetId: detailId, position: "APPROVE" });

    // Comentariu + validare ale membrului, pe ținta SKETCH (propria lui schiță).
    const [sketchComment] = await db
      .insert(comments)
      .values({ targetType: "SKETCH", targetId: memberSketchId, authorId: memberUserId, body: sketchCommentBody })
      .returning({ id: comments.id });
    sketchCommentId = sketchComment!.id;
    await db
      .insert(validations)
      .values({ userId: memberUserId, targetType: "SKETCH", targetId: memberSketchId, position: "APPROVE" });
  });

  test.afterAll(async () => {
    if (sketchCommentId) await db.delete(comments).where(eq(comments.id, sketchCommentId));
    if (detailCommentId) await db.delete(comments).where(eq(comments.id, detailCommentId));
    if (memberSketchId) {
      await db.delete(validations).where(eq(validations.targetId, memberSketchId));
      await db.delete(sketches).where(eq(sketches.id, memberSketchId));
    }
    if (detailId) {
      await db.delete(validations).where(eq(validations.targetId, detailId));
      await db.delete(details).where(eq(details.id, detailId));
    }
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
  });

  test("„Scoate în comunitate” ascunde comentariile/validările membrului — pe DETAIL ȘI pe SKETCH", async ({
    page,
    browser,
    baseURL,
  }) => {
    // Înainte de release: owner-ul (autorul detaliului) vede comentariul membrului pe detaliu.
    await page.goto(`/details/${detailId}`);
    await expect(page.getByText(detailCommentBody)).toBeVisible();

    await page.getByRole("button", { name: "Scoate în comunitate" }).click();
    await page.getByRole("button", { name: "Da, scoate în comunitate" }).click();
    await expect(page.getByText("proiect privat")).not.toBeVisible({ timeout: 10_000 });

    // Detaliul e acum public — dar conținutul membrului (pe DETAIL) rămâne ascuns, pentru oricine.
    await expect(page.getByText(detailCommentBody)).not.toBeVisible();

    const strangerCtx = await sessionContextFor(browser, baseURL, memberUserId, "SecAudit0811 Member", MEMBER_EMAIL);
    try {
      const spage = await strangerCtx.newPage();
      const res = await spage.goto(`/details/${detailId}`);
      expect(res?.status()).toBe(200);
      await expect(spage.getByText(detailCommentBody)).not.toBeVisible();
    } finally {
      await strangerCtx.close();
    }

    // Comentariul/validarea pe ținta SKETCH nu au un tab UI dedicat de verificat direct (dezbaterea e
    // unificată pe DETAIL — vezi comentariul din detailsRepo.ts) — verificate mai jos direct în DB,
    // pe aceeași coloană `hiddenAfterRelease` folosită de fix-ul din repo pentru ambele targetType-uri.

    const [detailCommentRow] = await db
      .select({ hidden: comments.hiddenAfterRelease })
      .from(comments)
      .where(eq(comments.id, detailCommentId));
    expect(detailCommentRow?.hidden).toBe(true);

    const [sketchCommentRow] = await db
      .select({ hidden: comments.hiddenAfterRelease })
      .from(comments)
      .where(eq(comments.id, sketchCommentId));
    expect(sketchCommentRow?.hidden).toBe(true);

    const [detailValidationRow] = await db
      .select({ hidden: validations.hiddenAfterRelease })
      .from(validations)
      .where(eq(validations.targetId, detailId));
    expect(detailValidationRow?.hidden).toBe(true);

    const [sketchValidationRow] = await db
      .select({ hidden: validations.hiddenAfterRelease })
      .from(validations)
      .where(eq(validations.targetId, memberSketchId));
    expect(sketchValidationRow?.hidden).toBe(true);
  });
});
