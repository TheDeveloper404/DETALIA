import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { db } from "../db";
import { details, projectMembers, projects } from "../db/schema";
import { blobStoreOptions, deleteOwnBlob } from "../lib/blob-store";
import { getSeed } from "./seed";

// "PUBLISHED+id = vizibil doar membrilor, PUBLISHED+null = public." (docs/ADR.md, ADR-014).
// "un membru eliminat nu trebuie să mai poată vedea imaginea ... verificarea de acces rulează din nou
// la fiecare request." (lib/project-image-proxy.ts).
test("DET-03: imagine privata reala, URL brut anonim refuzat si acces revocat cu aceeasi sesiune", async ({
  page,
  context,
}) => {
  const { testerUserId, authorUserId } = getSeed();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const upload = await put(`u/${authorUserId}/details/${crypto.randomUUID()}.png`, png, {
    access: "private",
    ...blobStoreOptions("private"),
    contentType: "image/png",
    addRandomSuffix: false,
  });
  let projectId: string | undefined;
  let detailId: string | undefined;
  try {
    const [project] = await db
      .insert(projects)
      .values({
        ownerId: authorUserId,
        name: "E2E fisiere private",
        inviteToken: crypto.randomUUID(),
      })
      .returning();
    projectId = project.id;
    await db.insert(projectMembers).values({ projectId, userId: testerUserId });
    const [detail] = await db
      .insert(details)
      .values({
        authorId: authorUserId,
        title: "E2E fisier privat",
        projectId,
        imageUrl: upload.url,
        status: "PUBLISHED",
      })
      .returning();
    detailId = detail.id;
    // Citire directa fara sesiune/Authorization, fara header-ele de bypass Vercel.
    expect((await fetch(upload.url)).ok).toBe(false);
    await page.goto(`/projects/${projectId}`);
    const image = page.locator(`img[src^="/api/project-image/detail/${detailId}"]`);
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const route = `/api/files/detail/${detailId}`;
    const readable = await page.evaluate(async (url) => {
      const response = await fetch(url);
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        bytes: (await response.arrayBuffer()).byteLength,
      };
    }, route);
    expect(readable).toEqual({ status: 200, cache: "private, no-store", bytes: png.byteLength });
    await db
      .update(projectMembers)
      .set({ removedAt: new Date() })
      .where(eq(projectMembers.projectId, projectId));
    expect(await page.evaluate(async (url) => (await fetch(url)).status, route)).toBe(403);
    await context.clearCookies();
    expect(await page.evaluate(async (url) => (await fetch(url)).status, route)).toBe(401);
  } finally {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
    await deleteOwnBlob(upload.url);
  }
});
