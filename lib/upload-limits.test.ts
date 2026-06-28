import { describe, expect, it } from "vitest";

import { BLOB_URL_RE } from "./upload-limits";

// BLOB_URL_RE = singura poartă care lasă URL-uri în DB după upload-ul client. Trebuie să accepte DOAR
// store-ul nostru Blob (anti-SSRF la reprocesare + anti-URL arbitrar în DB).
describe("BLOB_URL_RE — allowlist store Vercel Blob", () => {
  it("acceptă un URL al store-ului nostru (https + .public.blob.vercel-storage.com)", () => {
    expect(BLOB_URL_RE.test("https://abc123.public.blob.vercel-storage.com/avatars/x.png")).toBe(
      true,
    );
  });

  it("respinge alt host (chiar dacă conține numele store-ului)", () => {
    expect(BLOB_URL_RE.test("https://evil.com/avatars/x.png")).toBe(false);
    expect(
      BLOB_URL_RE.test("https://public.blob.vercel-storage.com.evil.com/x.png"),
    ).toBe(false);
  });

  it("respinge http (cere https)", () => {
    expect(BLOB_URL_RE.test("http://abc.public.blob.vercel-storage.com/x.png")).toBe(false);
  });

  it("respinge scheme periculoase și gunoi", () => {
    expect(BLOB_URL_RE.test("javascript:alert(1)")).toBe(false);
    expect(BLOB_URL_RE.test("")).toBe(false);
  });
});
