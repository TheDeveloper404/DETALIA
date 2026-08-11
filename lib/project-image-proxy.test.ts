import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isOwnBlobUrl } = vi.hoisted(() => ({ isOwnBlobUrl: vi.fn() }));
vi.mock("@/lib/blob-url", () => ({ isOwnBlobUrl }));

import { proxyBlobImage } from "@/lib/project-image-proxy";

const OWN_URL = "https://storeid.public.blob.vercel-storage.com/details/a.png";

describe("proxyBlobImage", () => {
  beforeEach(() => {
    isOwnBlobUrl.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("404 dacă URL-ul nu aparține store-ului nostru (nu ajunge să facă fetch)", async () => {
    isOwnBlobUrl.mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxyBlobImage("https://evil.example.com/x.png");
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404 dacă upstream-ul (Blob) răspunde eșuat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, body: null, headers: new Headers() }));
    const res = await proxyBlobImage(OWN_URL);
    expect(res.status).toBe(404);
  });

  it("streamuiește imaginea + Cache-Control: private, no-store pe succes", async () => {
    const body = new ReadableStream();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body, headers: new Headers({ "content-type": "image/png" }) }),
    );
    const res = await proxyBlobImage(OWN_URL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
