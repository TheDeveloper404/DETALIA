import { describe, expect, it } from "vitest";

import { looksLikeUploadedResource } from "./resource-type";

// looksLikeUploadedResource e singura logică pură din formularul de resurse — restul e interacțiune
// de formular (upload de fișier, stare de rânduri), netestabilă unitar. Verifică: doar tipurile
// UPLOADABILE (IMAGE/PDF/CAD) contează, LINK rămâne mereu câmp de text indiferent de valoare; doar
// un URL de pe storage-ul propriu (Vercel Blob) declanșează previzualizarea compactă, un link extern
// oarecare rămâne vizibil ca text (2026-08-16, raportat).
describe("looksLikeUploadedResource", () => {
  it("IMAGE cu URL de pe blob-ul propriu → true (previzualizare compactă)", () => {
    expect(
      looksLikeUploadedResource("IMAGE", "https://abc123.public.blob.vercel-storage.com/resources/x.png"),
    ).toBe(true);
  });

  it("PDF cu URL de pe blob-ul propriu → true", () => {
    expect(
      looksLikeUploadedResource("PDF", "https://abc123.public.blob.vercel-storage.com/resources/x.pdf"),
    ).toBe(true);
  });

  it("CAD cu URL de pe blob-ul propriu → true", () => {
    expect(
      looksLikeUploadedResource("CAD", "https://abc123.public.blob.vercel-storage.com/resources/x.dwg"),
    ).toBe(true);
  });

  it("IMAGE cu link extern (nu blob-ul propriu) → false, rămâne câmp de text", () => {
    expect(looksLikeUploadedResource("IMAGE", "https://example.com/poza.png")).toBe(false);
  });

  it("LINK — NICIODATĂ true, chiar dacă valoarea arată ca un URL de blob propriu", () => {
    expect(
      looksLikeUploadedResource("LINK", "https://abc123.public.blob.vercel-storage.com/resources/x.png"),
    ).toBe(false);
  });

  it("valoare goală → false", () => {
    expect(looksLikeUploadedResource("IMAGE", "")).toBe(false);
  });
});
