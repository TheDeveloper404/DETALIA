import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get, del } = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ get, del, put: vi.fn() }));

import { blobStoreOptions, deleteOwnBlob, readOwnBlob } from "./blob-store";
import { reprocessBlobImage } from "./image-processing";

const url = "https://testprivate.private.blob.vercel-storage.com/u/owner/details/a.png";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "testprivate");
  vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
  vi.stubEnv("BLOB_STORE_ID", "publicstore");
});
afterEach(() => vi.unstubAllEnvs());

describe("DET-03 — store privat", () => {
  // "Private Blob stores require authentication for all read and write operations" (Vercel Private Storage).
  it("citeste cu SDK-ul si store-ul privat explicit, fara fetch anonim sau store public implicit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new Response("png").body,
      blob: { contentType: "image/png" },
    });
    const result = await readOwnBlob(url);
    expect(await new Response(result!.body).text()).toBe("png");
    expect(get).toHaveBeenCalledWith(url, {
      access: "private",
      storeId: "testprivate",
      useCache: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // "nu orice store Vercel Blob oarecare ... STORE-UL NOSTRU" (lib/blob-url.ts).
  it("respinge store strain, userinfo si query fara sa foloseasca tokenul", async () => {
    for (const invalid of [
      url.replace("testprivate", "foreign"),
      url + "?x=1",
      url.replace("https://", "https://evil@"),
      url.replace(
        "testprivate.private.blob.vercel-storage.com",
        "TESTPRIVATE.PRIVATE.BLOB.VERCEL-STORAGE.COM",
      ),
      url.replace("a.png", "%61.png"),
      url.replace("a.png", "other/../a.png"),
    ]) {
      await expect(readOwnBlob(invalid)).rejects.toThrow("INVALID_BLOB_URL");
      await expect(deleteOwnBlob(invalid)).rejects.toThrow("INVALID_BLOB_URL");
    }
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("fara configurare privata esueaza inchis", () => {
    vi.stubEnv("BLOB_PRIVATE_STORE_ID", "");
    expect(() => blobStoreOptions("private")).toThrow("PRIVATE_BLOB_NOT_CONFIGURED");
  });

  it("sterge folosind store-ul potrivit", async () => {
    await deleteOwnBlob(url);
    expect(del).toHaveBeenCalledWith(url, { storeId: "testprivate" });
  });

  // "Avatarele, cover-urile si imaginile din comentarii ... in afara scopului" (plan aprobat DET-03).
  it.each(["avatars", "covers", "comments"])(
    "un URL privat pastrat nu poate fi exportat prin fluxul public %s",
    async (folder) => {
      expect(await reprocessBlobImage(url, folder, "owner")).toEqual({ ok: false });
      expect(get).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    },
  );
});
