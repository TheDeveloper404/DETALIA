import { encode } from "@auth/core/jwt";

import { expect, test, type Browser } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { canvases, details, projectCanvasShares, projects, roles, users } from "../db/schema";
import { deleteBlobs, uploadCanvasThumbnail } from "../lib/storage";
import { pickLeafCategories } from "./category-helpers";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — interacțiuni reale rămase netestate din feature „Proiect" Faza B/C (până acum doar unitar,
// vezi BACKLOG.md §Acum): redenumire inline a proiectului, partajare/ștergere planșă în grid, și
// creare detaliu din decupaj de planșă (§7 din plan, Faza C — `CanvasCropPicker`/`clampRect`).

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const MEMBER_EMAIL = "e2e-project-interactions-member@detalia.test";

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

// Sesiune construită direct (fără login UI) — model identic cu projects.spec.ts/suspended.spec.ts.
async function sessionContextFor(browser: Browser, baseURL: string | undefined, userId: string, name: string, email: string) {
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

// Seedează o planșă cu thumbnail REAL (upload în Blob) — `shareCanvasToProject` re-descarcă
// `thumbnailUrl` server-side, deci are nevoie de un URL Blob valid, nu doar un string oarecare.
async function seedCanvasWithThumbnail(ownerId: string, name: string): Promise<{ id: string; thumbnailUrl: string }> {
  const blob = new Blob([Buffer.from(TINY_PNG_BASE64, "base64")], { type: "image/png" });
  const uploaded = await uploadCanvasThumbnail(blob, ownerId);
  if (!uploaded.ok) throw new Error(`Seed thumbnail upload failed: ${uploaded.error}`);
  const [row] = await db
    .insert(canvases)
    .values({ ownerId, name, state: null, thumbnailUrl: uploaded.url })
    .returning({ id: canvases.id });
  return { id: row.id, thumbnailUrl: uploaded.url };
}

test.describe.serial("Proiecte — interacțiuni (Faza B/C): redenumire, partajare planșă, decupaj", () => {
  let projectId = "";
  let memberUserId = "";
  let memberCanvasId = "";

  test.afterAll(async () => {
    if (memberCanvasId) {
      const [row] = await db.select({ thumbnailUrl: canvases.thumbnailUrl }).from(canvases).where(eq(canvases.id, memberCanvasId));
      await db.delete(canvases).where(eq(canvases.id, memberCanvasId));
      if (row?.thumbnailUrl) await deleteBlobs([row.thumbnailUrl]);
    }
    if (projectId) {
      // Cascada pe project_canvas_shares (FK) șterge rândurile din DB, dar NU blob-urile — colectăm
      // URL-urile înainte de ștergere (capcană cunoscută, CLAUDE.md §Capcane tehnice).
      const shareRows = await db
        .select({ imageUrl: projectCanvasShares.imageUrl })
        .from(projectCanvasShares)
        .where(eq(projectCanvasShares.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
      if (shareRows.length > 0) await deleteBlobs(shareRows.map((r) => r.imageUrl));
    }
  });

  test("owner creează proiect + redenumește inline: Enter salvează, Escape anulează fără să salveze", async ({ page }) => {
    await page.goto("/projects");
    const originalName = `E2E Interacțiuni ${Date.now()}`;
    await page.getByPlaceholder(/Nume proiect/).fill(originalName);
    await page.getByRole("button", { name: "Creează proiect" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/, { timeout: 10_000 });
    projectId = page.url().split("/projects/")[1] ?? "";
    expect(projectId).toBeTruthy();

    const heading = page.getByRole("heading", { name: originalName });
    await expect(heading).toBeVisible();

    // Escape anulează: intrăm în editare, scriem alt text, Escape → numele vechi rămâne, NU se salvează.
    await heading.dblclick();
    const input = page.locator("input").first();
    await input.fill("Nume abandonat la Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: originalName })).toBeVisible();

    // Enter salvează: intrăm în editare din nou, scriem numele nou, Enter → salvat pe server.
    const renamedTo = `${originalName} redenumit`;
    await page.getByRole("heading", { name: originalName }).dblclick();
    const input2 = page.locator("input").first();
    await input2.fill(renamedTo);
    await input2.press("Enter");
    await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

    // Verificare pe server (nu doar UI optimist) — reîncărcăm pagina.
    await page.reload();
    await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

    const [row] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId));
    expect(row?.name).toBe(renamedTo);
  });

  test("membru se alătură, partajează o planșă proprie → apare în grid; membrul își șterge propria partajare", async ({
    browser,
    baseURL,
    page,
  }) => {
    memberUserId = await ensureActiveUserWithRole(MEMBER_EMAIL, "E2E Interacțiuni Member");

    // Owner deschide modalul de invitație și extrage tokenul (link ascuns după buton, redesign 2026-08-11).
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: "Invită membri" }).click();
    const linkCode = page.locator("code");
    await expect(linkCode).toBeVisible();
    const inviteToken = ((await linkCode.textContent()) ?? "").split("/projects/join/")[1]?.trim() ?? "";
    expect(inviteToken).toBeTruthy();
    await page.keyboard.press("Escape");

    const seeded = await seedCanvasWithThumbnail(memberUserId, "Planșă E2E de partajat");
    memberCanvasId = seeded.id;

    const memberCtx = await sessionContextFor(browser, baseURL, memberUserId, "E2E Interacțiuni Member", MEMBER_EMAIL);
    try {
      const mpage = await memberCtx.newPage();
      await mpage.goto(`/projects/join/${inviteToken}`);
      await mpage.getByRole("button", { name: "Alătură-te proiectului" }).click();
      await expect(mpage).toHaveURL(new RegExp(`/projects/${projectId}$`), { timeout: 10_000 });

      // Regresie /code-review 2026-08-11: linkul de invitație era vizibil oricărui membru (nu doar
      // owner-ului), care l-ar fi putut redistribui în afara proiectului. Doar owner-ul vede butonul.
      await expect(mpage.getByRole("button", { name: "Invită membri" })).not.toBeVisible();

      await mpage.getByRole("main").getByRole("button", { name: "Adaugă" }).click();
      await mpage.getByRole("button", { name: "Adaugă planșă" }).click();
      await mpage.getByRole("button", { name: "Planșă E2E de partajat" }).click();

      // Butonul din modal are ACELAȘI text ca numele planșei — un assert pe text simplu s-ar potrivi
      // și pe modalul încă deschis, fals-pozitiv. Așteptăm întâi închiderea reală a modalului.
      await expect(mpage.getByRole("dialog", { name: "Adaugă în proiect" })).not.toBeVisible({
        timeout: 10_000,
      });

      const [shareRow] = await db
        .select({ id: projectCanvasShares.id })
        .from(projectCanvasShares)
        .where(eq(projectCanvasShares.projectId, projectId));
      expect(shareRow?.id).toBeTruthy();

      // Tile-ul din grid — verificat prin butonul „Șterge partajarea", care există DOAR pe tile
      // (nu în modal), deci e o dovadă reală că partajarea a ajuns în grid, nu doar în DB.
      const deleteShareButton = mpage.getByRole("button", { name: "Șterge partajarea" });
      await expect(deleteShareButton).toBeVisible({ timeout: 10_000 });
      await expect(mpage.getByRole("main").getByText("Planșă E2E de partajat")).toBeVisible();

      // Bug real 2026-08-16 (raportat): planșa nu purta numele autorului deloc. Verificăm live
      // (JOIN la citire), nu doar prezența în DB — caption-ul tile-ului trebuie să conțină numele.
      // Scopat la tile (nu la "main") — sidebar-ul de membri conține și el același nume, ceea ce
      // producea strict-mode violation (2 potriviri) pe un locator prea larg.
      const shareTile = mpage
        .getByRole("button", { name: "Vezi planșa: Planșă E2E de partajat" })
        .locator("xpath=..");
      await expect(shareTile.getByText("E2E Interacțiuni Member")).toBeVisible();

      // Bug real 2026-08-16 (raportat): tile-ul era doar previzualizare, fără click — DOAR
      // butonul de ștergere funcționa. Verificăm că „intri" în ea (lightbox), nu doar o vezi mică.
      await mpage.getByRole("button", { name: "Vezi planșa: Planșă E2E de partajat" }).click();
      const lightbox = mpage.getByRole("dialog");
      await expect(lightbox).toBeVisible();
      await mpage.getByRole("button", { name: "Închide" }).click();
      await expect(lightbox).not.toBeVisible();

      // Sharer-ul își poate șterge propria partajare.
      await deleteShareButton.click();
      await expect(mpage.getByRole("main").getByText("Planșă E2E de partajat")).not.toBeVisible({
        timeout: 10_000,
      });

      const remaining = await db
        .select({ id: projectCanvasShares.id })
        .from(projectCanvasShares)
        .where(eq(projectCanvasShares.projectId, projectId));
      expect(remaining.length).toBe(0);
    } finally {
      await memberCtx.close();
    }
  });

  test("owner poate șterge o partajare a altui membru (nu doar pe-a proprie)", async ({ browser, baseURL, page }) => {
    // Membrul partajează din nou aceeași planșă (owner-ul o va șterge, nu sharer-ul).
    const memberCtx = await sessionContextFor(browser, baseURL, memberUserId, "E2E Interacțiuni Member", MEMBER_EMAIL);
    try {
      const mpage = await memberCtx.newPage();
      await mpage.goto(`/projects/${projectId}`);
      await mpage.getByRole("main").getByRole("button", { name: "Adaugă" }).click();
      await mpage.getByRole("button", { name: "Adaugă planșă" }).click();
      await mpage.getByRole("button", { name: "Planșă E2E de partajat" }).click();
      await expect(mpage.getByRole("dialog", { name: "Adaugă în proiect" })).not.toBeVisible({
        timeout: 10_000,
      });
      await expect(mpage.getByRole("button", { name: "Șterge partajarea" })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await memberCtx.close();
    }

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("main").getByText("Planșă E2E de partajat")).toBeVisible();
    await page.getByRole("button", { name: "Șterge partajarea" }).click();
    await expect(page.getByRole("main").getByText("Planșă E2E de partajat")).not.toBeVisible({
      timeout: 10_000,
    });

    const remaining = await db
      .select({ id: projectCanvasShares.id })
      .from(projectCanvasShares)
      .where(eq(projectCanvasShares.projectId, projectId));
    expect(remaining.length).toBe(0);
  });

  test("creare detaliu din decupaj de planșă (§7, Faza C) → publicat cu imaginea decupată", async ({ page }) => {
    // Reutilizează planșa owner-ului (creată în afara proiectului — decupajul nu e specific unui proiect).
    const ownerId = (await db.select({ id: users.id }).from(users).where(eq(users.email, "e2e-tester@detalia.test")).limit(1))[0]?.id;
    expect(ownerId).toBeTruthy();
    const seeded = await seedCanvasWithThumbnail(ownerId!, "Planșă E2E pentru decupaj");

    let detailId: string | null = null;
    let imageUrl: string | null = null;
    try {
      // Headerul global de bypass Vercel (playwright.config.ts) se propagă și la fetch-ul cross-origin
      // al thumbnail-ului (CropStage, crossOrigin="anonymous") → preflight CORS eșuat, doar sub
      // Playwright (vezi strip-bypass-headers.ts, folosit deja de teste de upload pentru același motiv).
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(`E2E din decupaj planșă ${Date.now()}`);

      const [category] = await pickLeafCategories(1);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Dintr-o planșă" }).click();
      await page.getByText("Planșă E2E pentru decupaj").click();
      await page.getByRole("button", { name: "Aplică decupajul" }).click();

      // Decupajul intră EXACT ca un upload normal — același buton „Înlocuiește" confirmă preview-ul.
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 10_000 });

      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 15_000 });

      detailId = page.url().split("/details/")[1] ?? null;
      expect(detailId).toBeTruthy();

      if (detailId) {
        const [row] = await db.select({ imageUrl: details.imageUrl }).from(details).where(eq(details.id, detailId));
        imageUrl = row?.imageUrl ?? null;
        expect(imageUrl).toBeTruthy();
      }
    } finally {
      if (detailId) {
        await db.delete(details).where(eq(details.id, detailId));
      }
      if (imageUrl) await deleteBlobs([imageUrl]);
      await db.delete(canvases).where(eq(canvases.id, seeded.id));
      await deleteBlobs([seeded.thumbnailUrl]);
    }
  });
});
