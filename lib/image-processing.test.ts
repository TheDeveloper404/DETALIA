import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "testprivate");
});
afterEach(() => vi.unstubAllEnvs());

const { put, del } = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put, del }));

import sharp from "sharp";

import { processAndUploadImage, reprocessBlobImage } from "@/lib/image-processing";
import * as blobStore from "@/lib/blob-store";

// PNG 1x1 real, generat cu sharp (nu hardcodat) — garantat decodabil, ca `cleanImageBuffer` să treacă.
async function tinyPngBlob(): Promise<Blob> {
  const bytes = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Blob([bytes], { type: "image/png" });
}

// SEC-N04 (audit securitate 2026-08-20): thumbnail-urile urcate prin această funcție (schiță/planșă/share
// de proiect) nu erau prefixate cu namespace-ul userului, spre deosebire de upload-ul client
// (/api/blob/upload) — `isUsersBlobUrl` nu le-ar fi putut valida ca aparținând userului care le-a urcat.
describe("processAndUploadImage — namespace u/<userId>/ (SEC-N04)", () => {
  it("urcă sub calea u/<userId>/<folder>/... , nu doar <folder>/...", async () => {
    put.mockResolvedValueOnce({
      url: "https://store.public.blob.vercel-storage.com/u/user-123/sketches/x.png",
    });

    const result = await processAndUploadImage(await tinyPngBlob(), "sketches", "user-123");

    expect(result.ok).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    const [path] = put.mock.calls[0] as [string, unknown, unknown];
    expect(path).toMatch(/^u\/user-123\/sketches\//);
    expect(put.mock.calls[0][2]).toMatchObject({ access: "private", storeId: "testprivate" });
  });

  it("respectă folder-ul dat pentru fiecare tip de conținut (canvases, project-shares)", async () => {
    put.mockClear();
    put.mockResolvedValueOnce({
      url: "https://store.public.blob.vercel-storage.com/u/user-9/canvases/x.png",
    });
    await processAndUploadImage(await tinyPngBlob(), "canvases", "user-9");
    const [canvasPath] = put.mock.calls[0] as [string, unknown, unknown];
    expect(canvasPath).toMatch(/^u\/user-9\/canvases\//);

    put.mockResolvedValueOnce({
      url: "https://store.public.blob.vercel-storage.com/u/user-9/project-shares/x.png",
    });
    await processAndUploadImage(await tinyPngBlob(), "project-shares", "user-9");
    const [sharePath] = put.mock.calls[1] as [string, unknown, unknown];
    expect(sharePath).toMatch(/^u\/user-9\/project-shares\//);
  });
});

// Regula aprobata: "fisierele mari se incarca direct; serverul ... reprocesseaza imaginea".
it("reencodeaza din storage un JPEG valid peste 4.5 MB si elimina sursa staging", async () => {
  const jpeg = await sharp({ create: { width: 32, height: 32, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
  const bytes = Buffer.concat([jpeg, Buffer.alloc(5_000_000 - jpeg.length)]);
  const source =
    "https://testprivate.private.blob.vercel-storage.com/u/user-123/sketches/uploads/raw.jpg";
  const read = vi
    .spyOn(blobStore, "readOwnBlob")
    .mockResolvedValue({ body: new Blob([bytes]).stream(), contentType: "image/jpeg" });
  const remove = vi.spyOn(blobStore, "deleteOwnBlob").mockResolvedValue(undefined);
  put.mockResolvedValue({
    url: "https://testprivate.private.blob.vercel-storage.com/u/user-123/sketches/clean.jpg",
  });
  try {
    const result = await reprocessBlobImage(source, "sketches", "user-123");
    expect(result.ok).toBe(true);
    const processed = put.mock.calls[0][1] as Buffer;
    expect((await sharp(processed).metadata()).format).toBe("jpeg");
    expect(processed.length).toBeLessThan(bytes.length);
    expect(remove).toHaveBeenCalledWith(source);
    expect(put.mock.calls[0][0]).toMatch(/^u\/user-123\/sketches\/[^/]+\.jpg$/);
  } finally {
    read.mockRestore();
    remove.mockRestore();
  }
});

// Imaginea s-a urcat CLIENT direct în Blob; validarea finală o face DetailService.
it.each([false, true])(
  "pastreaza staging-ul pentru retry inclusiv la esecul reprocesarii (%s)",
  async (uploadFails) => {
    const source =
      "https://testprivate.private.blob.vercel-storage.com/u/user-123/details/uploads/raw.png";
    const bytes = await (await tinyPngBlob()).arrayBuffer();
    const read = vi
      .spyOn(blobStore, "readOwnBlob")
      .mockImplementation(async () => ({
        body: new Blob([bytes]).stream(),
        contentType: "image/png",
      }));
    const remove = vi.spyOn(blobStore, "deleteOwnBlob").mockResolvedValue(undefined);
    put.mockReset();
    if (uploadFails) put.mockRejectedValueOnce(new Error("upload unavailable"));
    put.mockResolvedValue({
      url: "https://testprivate.private.blob.vercel-storage.com/u/user-123/details/processed.png",
    });
    try {
      const first = await reprocessBlobImage(source, "details", "user-123", {
        preserveOriginal: true,
      });
      expect(first.ok).toBe(!uploadFails);
      expect(remove).not.toHaveBeenCalled();
      const retry = await reprocessBlobImage(source, "details", "user-123", {
        preserveOriginal: true,
      });
      expect(retry.ok).toBe(true);
      expect(remove).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      remove.mockRestore();
    }
  },
);
