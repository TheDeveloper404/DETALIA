import { describe, expect, it, vi } from "vitest";

const { put, del } = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put, del }));

import sharp from "sharp";

import { processAndUploadImage } from "@/lib/image-processing";

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
    put.mockResolvedValueOnce({ url: "https://store.public.blob.vercel-storage.com/u/user-123/sketches/x.png" });

    const result = await processAndUploadImage(await tinyPngBlob(), "sketches", "user-123");

    expect(result.ok).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    const [path] = put.mock.calls[0] as [string, unknown, unknown];
    expect(path).toMatch(/^u\/user-123\/sketches\//);
  });

  it("respectă folder-ul dat pentru fiecare tip de conținut (canvases, project-shares)", async () => {
    put.mockClear();
    put.mockResolvedValueOnce({ url: "https://store.public.blob.vercel-storage.com/u/user-9/canvases/x.png" });
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
