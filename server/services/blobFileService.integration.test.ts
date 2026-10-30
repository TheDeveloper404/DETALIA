import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const { db, client } = await createTestDb();
  return { db, client };
});
const { identity, get, del } = vi.hoisted(() => ({ identity: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/require-active-api-user", () => ({ requireActiveApiUserId: identity }));
vi.mock("@vercel/blob", () => ({ get, del, put: vi.fn() }));

import { db } from "@/db";
import {
  users,
  projects,
  projectMembers,
  details,
  detailResources,
  sketches,
  canvases,
  projectCanvasShares,
  materialOffers,
  materialOfferFiles,
} from "@/db/schema";
import { canUseBlobUrls, deleteStagingBlobs, getReadableBlobFile } from "./blobFileService";
import { GET } from "@/app/api/files/[kind]/[id]/route";

const url = (name: string) =>
  `https://testprivate.private.blob.vercel-storage.com/u/owner/details/${name}.png`;
let owner: string, member: string, stranger: string, projectId: string;
let privateId: string,
  publicId: string,
  draftId: string,
  sketchId: string,
  resourceId: string,
  canvasId: string,
  shareId: string,
  offerId: string;

beforeAll(async () => {
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "testprivate");
  for (const name of ["owner", "member", "stranger"]) {
    const [row] = await db
      .insert(users)
      .values({ email: `${name}@blob.test` })
      .returning();
    if (name === "owner") owner = row.id;
    else if (name === "member") member = row.id;
    else stranger = row.id;
  }
  const [project] = await db
    .insert(projects)
    .values({ name: "Privat", ownerId: owner, inviteToken: "fixture-not-secret" })
    .returning();
  projectId = project.id;
  await db.insert(projectMembers).values({ projectId, userId: member });
  const [priv, pub, draft] = await db
    .insert(details)
    .values([
      {
        title: "Privat",
        authorId: owner,
        projectId,
        imageUrl: url("private"),
        status: "PUBLISHED",
      },
      { title: "Public", authorId: owner, imageUrl: url("public"), status: "PUBLISHED" },
      { title: "Draft", authorId: owner, imageUrl: url("draft"), status: "DRAFT" },
    ])
    .returning();
  privateId = priv.id;
  publicId = pub.id;
  draftId = draft.id;
  const [sketch] = await db
    .insert(sketches)
    .values({
      detailId: privateId,
      authorId: member,
      thumbnailUrl: url("sketch"),
      status: "PUBLISHED",
    })
    .returning();
  sketchId = sketch.id;
  const [resource] = await db
    .insert(detailResources)
    .values({ detailId: privateId, type: "PDF", url: url("resource") })
    .returning();
  resourceId = resource.id;
  const [canvas] = await db
    .insert(canvases)
    .values({ name: "Plansa", ownerId: owner, thumbnailUrl: url("canvas") })
    .returning();
  canvasId = canvas.id;
  const [share] = await db
    .insert(projectCanvasShares)
    .values({ projectId, sharedByUserId: owner, name: "Partajat", imageUrl: url("share") })
    .returning();
  shareId = share.id;
  const [offer] = await db
    .insert(materialOffers)
    .values({ detailId: publicId, supplierId: member, message: "Oferta" })
    .returning();
  const [file] = await db
    .insert(materialOfferFiles)
    .values({ offerId: offer.id, url: url("offer"), fileName: "Oferta.pdf", fileSize: 10 })
    .returning();
  offerId = file.id;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  const { client } = (await import("@/db")) as unknown as { client: { close(): Promise<void> } };
  await client.close();
});

describe("DET-03 — autorizare pe date SQL reale", () => {
  // "PUBLISHED+id = vizibil doar membrilor, PUBLISHED+null = public." (ADR-014).
  it("public citibil anonim; proiectul cere membru, inclusiv resursa si thumbnail", async () => {
    expect((await getReadableBlobFile("detail", publicId, null)).ok).toBe(true);
    for (const [kind, id] of [
      ["detail", privateId],
      ["resource", resourceId],
      ["sketch", sketchId],
      ["canvas-share", shareId],
    ]) {
      expect((await getReadableBlobFile(kind, id, member)).ok).toBe(true);
      expect((await getReadableBlobFile(kind, id, stranger)).ok).toBe(false);
      expect((await getReadableBlobFile(kind, id, null)).ok).toBe(false);
    }
  });

  // "DRAFT+null = ciornă" (ADR-014); "canvasul privat per user" (server/domain/plansa.ts).
  it("draftul si plansa personala sunt doar pentru owner", async () => {
    for (const [kind, id] of [
      ["detail", draftId],
      ["canvas", canvasId],
    ]) {
      expect((await getReadableBlobFile(kind, id, owner)).ok).toBe(true);
      expect((await getReadableBlobFile(kind, id, member)).ok).toBe(false);
      expect((await getReadableBlobFile(kind, id, null)).ok).toBe(false);
    }
  });

  // "O ofertă per (furnizor, detaliu) — se editează, nu se duplică. Vizibilă DOAR autorului detaliului." (materialOfferService.ts).
  it("oferta pe detaliu public ramane privata pentru owner si furnizorul ei", async () => {
    expect((await getReadableBlobFile("offer", offerId, owner)).ok).toBe(true);
    expect((await getReadableBlobFile("offer", offerId, member)).ok).toBe(true);
    expect((await getReadableBlobFile("offer", offerId, stranger)).ok).toBe(false);
    expect((await getReadableBlobFile("offer", offerId, null)).ok).toBe(false);
  });

  // "Autorul care s-a retras de pe continut nu mai primeste notificari despre el." (notificationService.ts)
  it("autorul retras nu mai descarca fisierele ofertei; furnizorul da", async () => {
    await db.update(details).set({ anonymizedAt: new Date() }).where(eq(details.id, publicId));
    expect((await getReadableBlobFile("offer", offerId, owner)).ok).toBe(false);
    expect((await getReadableBlobFile("offer", offerId, member)).ok).toBe(true);
    await db.update(details).set({ anonymizedAt: null }).where(eq(details.id, publicId));
  });

  // Stergerea nu ocoleste regula de stergere: "o adnotare pe care altii au construit nu dispare" (edit/actions.ts).
  it("staging-ul se sterge doar daca e imagine de detaliu proprie si nefolosita", async () => {
    const base = `https://testprivate.private.blob.vercel-storage.com/u/${owner}`;
    await db.insert(details).values({ title: "Folosit", authorId: owner, imageUrl: `${base}/details/used.png`, status: "PUBLISHED" });
    del.mockClear();
    await deleteStagingBlobs([
      `${base}/details/staging.png`, `${base}/details/used.png`, `${base}/avatars/me.png`,
      `https://testprivate.private.blob.vercel-storage.com/u/${member}/details/other.png`, null,
    ], owner);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.mock.calls[0][0]).toEqual([`${base}/details/staging.png`]);
  });

  // "un membru eliminat nu trebuie să mai poată vedea imaginea" (lib/project-image-proxy.ts).
  it("namespace-ul propriu nu permite republicarea unui fisier dupa pierderea accesului", async () => {
    const keptUrl = `https://testprivate.private.blob.vercel-storage.com/u/${member}/details/kept.png`;
    await db.insert(details).values({
      title: "Al membrului",
      authorId: member,
      projectId,
      imageUrl: keptUrl,
      status: "PUBLISHED",
    });
    expect(await canUseBlobUrls([keptUrl], member)).toBe(true);
    await db
      .update(projectMembers)
      .set({ removedAt: new Date() })
      .where(eq(projectMembers.userId, member));
    expect(await canUseBlobUrls([keptUrl], member)).toBe(false);
    // "Namespace-ul upload-ului nu inlocuieste accesul curent la continutul deja persistat." (blobFileService.ts).
    const aliases = [
      keptUrl.replace(
        "testprivate.private.blob.vercel-storage.com",
        "TESTPRIVATE.PRIVATE.BLOB.VERCEL-STORAGE.COM",
      ),
      keptUrl.replace("https://", "HTTPS://"),
      keptUrl.replace(".com/", ".com:443/"),
      keptUrl.replace("kept.png", "%6bept.png"),
      keptUrl.replace("kept.png", "other/../kept.png"),
    ];
    for (const alias of aliases) expect(await canUseBlobUrls([alias], member)).toBe(false);
    // Upload nou, inca nereferit: numai uploader-ul il poate folosi.
    const freshUrl = keptUrl.replace("kept.png", "fresh.png");
    expect(await canUseBlobUrls([freshUrl], member)).toBe(true);
    expect(await canUseBlobUrls([freshUrl], stranger)).toBe(false);
    await db
      .update(projectMembers)
      .set({ removedAt: null })
      .where(eq(projectMembers.userId, member));
  });

  // "un membru eliminat nu trebuie să mai poată vedea imaginea nici din cache-ul browserului la următoarea cerere; verificarea de acces rulează din nou" (project-image-proxy.ts).
  it("ruta livreaza stream privat, apoi refuza aceeasi cerere dupa eliminare cu aceeasi sesiune", async () => {
    identity.mockResolvedValue({ ok: true, userId: member });
    get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Response("png").body,
      blob: { contentType: "image/png" },
    });
    const request = () =>
      GET(new Request("https://detalia.test/api/files/detail/test"), {
        params: Promise.resolve({ kind: "detail", id: privateId }),
      });
    const first = await request();
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(await first.text()).toBe("png");
    await db
      .update(projectMembers)
      .set({ removedAt: new Date() })
      .where(eq(projectMembers.userId, member));
    const denied = await request();
    expect(denied.status).toBe(403);
    expect(get).toHaveBeenCalledTimes(1);
    await db
      .update(projectMembers)
      .set({ removedAt: null })
      .where(eq(projectMembers.userId, member));
  });

  // "release publică DOAR conținutul autorului detaliului." (detailsRepo.ts).
  it("dupa release, thumbnail-ul ascuns este refuzat inclusiv fostului autor", async () => {
    await db.update(details).set({ projectId: null }).where(eq(details.id, privateId));
    await db.update(sketches).set({ hiddenAfterRelease: true }).where(eq(sketches.id, sketchId));
    expect((await getReadableBlobFile("detail", privateId, null)).ok).toBe(true);
    for (const actor of [owner, member, stranger, null])
      expect((await getReadableBlobFile("sketch", sketchId, actor)).ok).toBe(false);
  });

  it("tip necunoscut, ID invalid, entitate lipsa si tip schimbat nu dau acces", async () => {
    for (const [kind, id] of [
      ["unknown", publicId],
      ["detail", "invalid"],
      ["canvas", publicId],
      ["detail", crypto.randomUUID()],
    ]) {
      expect(await getReadableBlobFile(kind, id, owner)).toEqual({ ok: false, error: "NOT_FOUND" });
    }
  });
});
