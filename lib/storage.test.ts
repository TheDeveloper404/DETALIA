import { describe, expect, it, vi } from "vitest";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del }));

import { deleteBlobs } from "@/lib/storage";

const VALID_URL = "https://oqhrxxllqvcxn05s.public.blob.vercel-storage.com/details/a.png";

describe("deleteBlobs", () => {
  it("filtrează URL-uri care nu aparțin store-ului Blob curent (host greșit)", async () => {
    del.mockResolvedValueOnce(undefined);
    await deleteBlobs(["https://example.com/not-a-blob.png", null, undefined]);
    expect(del).not.toHaveBeenCalled();
  });

  it("cheamă del() doar cu URL-urile valide de Blob", async () => {
    del.mockResolvedValueOnce(undefined);
    await deleteBlobs([VALID_URL, "https://example.com/not-a-blob.png"]);
    expect(del).toHaveBeenCalledWith([VALID_URL]);
  });

  it("nu aruncă dacă del() eșuează (best-effort)", async () => {
    del.mockRejectedValueOnce(new Error("Some urls are malformed"));
    await expect(deleteBlobs([VALID_URL])).resolves.toBeUndefined();
  });

  // /code-review QODO (2026-08-11): loga array-ul complet de URL-uri pe eroare — doar count+host acum.
  it("pe eroare, NU loghează URL-urile complete (doar count + host)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    del.mockRejectedValueOnce(new Error("Some urls are malformed"));
    await deleteBlobs([VALID_URL]);
    const loggedArgs = errSpy.mock.calls[0] ?? [];
    expect(loggedArgs.some((a) => typeof a === "string" && a.includes(VALID_URL))).toBe(false);
    errSpy.mockRestore();
  });
});
