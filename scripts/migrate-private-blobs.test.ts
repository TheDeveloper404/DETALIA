import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as { id: string; url: string }[],
  read: vi.fn(),
  del: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        then: (resolve: (rows: typeof mocks.rows) => unknown) =>
          Promise.resolve(mocks.rows).then(resolve),
        where: async () => mocks.rows,
      }),
    }),
    update: mocks.update,
  }),
}));
vi.mock("@vercel/blob", () => ({ put: mocks.put, list: mocks.list }));
vi.mock("../lib/blob-store", () => ({
  blobStoreOptions: () => ({ storeId: "testprivate" }),
  isPrivateBlobUrl: (url: string) => url.includes(".private.blob."),
  readOwnBlob: mocks.read,
  deleteOwnBlob: mocks.del,
}));

const source = "https://testpublic.public.blob.vercel-storage.com/u/owner/details/a.png";
const destination = source.replace("testpublic.public", "testprivate.private");
let directory: string, manifestPath: string;
const originalArgv = process.argv;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.rows = [];
  mocks.list.mockResolvedValue({ blobs: [], hasMore: false });
  directory = mkdtempSync(join(tmpdir(), "detalia-blob-migration-test-"));
  manifestPath = join(directory, "manifest.json");
  vi.stubEnv(
    "BLOB_MIGRATION_DATABASE_URLS",
    JSON.stringify({
      production: "postgres://fixture/prod",
      preview: "postgres://fixture/preview",
    }),
  );
  vi.stubEnv("BLOB_STORE_ID", "testpublic");
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "testprivate");
  vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});
afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  rmSync(manifestPath, { force: true });
  rmdirSync(directory);
});

function manifest() {
  const sha256 = createHash("sha256").update("content").digest("hex");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: 1,
      databases: ["preview", "production"],
      refs: [{ database: "production", table: "details", id: crypto.randomUUID(), source }],
      sources: [source],
      copies: { [source]: { url: destination, sha256, size: 7 } },
    }),
  );
  mocks.read.mockImplementation(async () => ({
    body: new Response("content").body,
    contentType: "image/png",
  }));
}
async function run(phase: string, confirmed = false) {
  process.argv = [
    "node",
    "vitest",
    phase,
    manifestPath,
    ...(confirmed ? ["--cutover-confirmed"] : []),
  ];
  const { runBlobMigration } = await import("./migrate-private-blobs");
  return runBlobMigration();
}

describe("DET-03 — migrare fara pierdere de date", () => {
  // "Include si copii vechi/orfane, nu doar fisierele inca referite in DB." (migrate-private-blobs.ts).
  it("inventariaza si copia orfana, fara scrieri externe sau avatare", async () => {
    mocks.list.mockResolvedValue({
      blobs: [
        { url: source, pathname: "u/owner/details/a.png" },
        { url: source.replace("details", "avatars"), pathname: "u/owner/avatars/a.png" },
      ],
      hasMore: false,
    });
    await run("inventory");
    expect(JSON.parse(readFileSync(manifestPath, "utf8")).sources).toEqual([source]);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "copy verifica SHA-256/size si nu suprascrie coliziuni" (docs/DEPLOY.md).
  it("coliziunea cu bytes diferiti opreste copierea, fara stergere sau suprascriere", async () => {
    manifest();
    mocks.read.mockImplementation(async (url: string) => ({
      body: new Response(url === source ? "content" : "different").body,
      contentType: "image/png",
    }));
    await expect(run("copy")).rejects.toThrow("Coliziune");
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "Scriptul refuza stergerea daca mai exista referinte publice" (docs/DEPLOY.md).
  it("o referinta publica ramasa in alta baza opreste purge inainte de orice stergere", async () => {
    manifest();
    mocks.rows = [{ id: crypto.randomUUID(), url: source }];
    await expect(run("purge")).rejects.toThrow("referinte publice");
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "Dupa teste Preview verzi, backup privat verificat si confirmarea listei complete a bazelor" (docs/DEPLOY.md).
  it("fara confirmare de cutover, purge nu sterge sursele chiar daca nu mai au referinte", async () => {
    manifest();
    await expect(run("purge")).rejects.toThrow("--cutover-confirmed");
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "apply schimba numai valoarea veche inventariata" (docs/DEPLOY.md).
  it("editarea concurenta opreste apply fara sa suprascrie noua referinta", async () => {
    manifest();
    mocks.rows = [{ id: crypto.randomUUID(), url: source.replace("a.png", "new.png") }];
    await expect(run("apply")).rejects.toThrow("Referinta schimbata");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "Include si copii vechi/orfane, nu doar fisierele inca referite in DB." (migrate-private-blobs.ts).
  it.each(["verify", "purge"])(
    "%s refuza un orfan public nou, inclusiv pe a doua pagina, aparut dupa inventar",
    async (phase) => {
      manifest();
      mocks.list.mockResolvedValueOnce({
        blobs: [{ url: source, pathname: "u/owner/details/a.png" }],
        hasMore: true,
        cursor: "next",
      });
      mocks.list.mockResolvedValueOnce({
        blobs: [{ url: source.replace("a.png", "late.png"), pathname: "u/owner/details/late.png" }],
        hasMore: false,
      });
      await expect(run(phase, true)).rejects.toThrow("neinventariate");
      expect(mocks.del).not.toHaveBeenCalled();
      expect(mocks.list).toHaveBeenCalledTimes(2);
    },
  );

  it("verify cere confirmarea opririi scrierilor vechi", async () => {
    manifest();
    await expect(run("verify")).rejects.toThrow("--cutover-confirmed");
    expect(mocks.del).not.toHaveBeenCalled();
  });

  // "Scriptul refuza stergerea daca mai exista referinte publice" (docs/DEPLOY.md).
  it("purge accepta numai inventarul final complet si pastreaza fisierele publice din afara scopului", async () => {
    manifest();
    mocks.list.mockResolvedValue({
      blobs: [
        { url: source, pathname: "u/owner/details/a.png" },
        { url: source.replace("details", "avatars"), pathname: "u/owner/avatars/a.png" },
      ],
      hasMore: false,
    });
    await run("purge", true);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledExactlyOnceWith(source);
  });
});
