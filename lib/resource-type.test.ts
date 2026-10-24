import { describe, expect, it } from "vitest";

import { isIfcUrl, looksLikeUploadedResource } from "./resource-type";

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

// isIfcUrl decide doar dacă apare butonul „3D" lângă resursa CAD (viewer-ul IFC).
describe("isIfcUrl", () => {
  it(".ifc / .IFC → true", () => {
    expect(isIfcUrl("https://abc123.public.blob.vercel-storage.com/resources/casa-Xy12.ifc")).toBe(true);
    expect(isIfcUrl("https://abc123.public.blob.vercel-storage.com/resources/CASA.IFC")).toBe(true);
  });

  it(".dwg / .dxf → false (nu au viewer 3D)", () => {
    expect(isIfcUrl("https://abc123.public.blob.vercel-storage.com/resources/x.dwg")).toBe(false);
    expect(isIfcUrl("https://abc123.public.blob.vercel-storage.com/resources/x.dxf")).toBe(false);
  });

  it("query string / hash după extensie → tot .ifc", () => {
    expect(isIfcUrl("https://example.com/model.ifc?download=1")).toBe(true);
    expect(isIfcUrl("https://example.com/model.ifc#etaj1")).toBe(true);
  });

  it(".ifc doar în query, nu în path → false", () => {
    expect(isIfcUrl("https://example.com/download?file=model.ifc")).toBe(false);
  });
});
