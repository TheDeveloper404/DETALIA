import { describe, expect, it } from "vitest";

import { MATERIAL_OFFER_MESSAGE_MAX_LENGTH, validateMaterialOfferInput } from "./materialOffer";

const validFile = {
  url: "https://abc123.public.blob.vercel-storage.com/u/user-1/materials/f1.pdf",
  fileName: "lista.pdf",
  fileSize: 1024,
};

describe("validateMaterialOfferInput — mesaj", () => {
  it("mesaj lipsă → MESSAGE_REQUIRED", () => {
    expect(validateMaterialOfferInput({ message: undefined, files: [validFile] })).toEqual({
      ok: false,
      error: "MESSAGE_REQUIRED",
    });
  });

  it("mesaj gol/whitespace → MESSAGE_REQUIRED (trim)", () => {
    expect(validateMaterialOfferInput({ message: "   ", files: [validFile] })).toEqual({
      ok: false,
      error: "MESSAGE_REQUIRED",
    });
  });

  it(`mesaj peste ${MATERIAL_OFFER_MESSAGE_MAX_LENGTH} caractere → MESSAGE_TOO_LONG`, () => {
    const long = "a".repeat(MATERIAL_OFFER_MESSAGE_MAX_LENGTH + 1);
    expect(validateMaterialOfferInput({ message: long, files: [validFile] })).toEqual({
      ok: false,
      error: "MESSAGE_TOO_LONG",
    });
  });

  it("mesaj valid → trimmed în rezultat", () => {
    const res = validateMaterialOfferInput({ message: "  Vezi lista atașată  ", files: [validFile] });
    expect(res).toEqual({ ok: true, message: "Vezi lista atașată", files: [validFile] });
  });
});

describe("validateMaterialOfferInput — fișiere", () => {
  it("0 fișiere → NO_FILES (mesaj fără nimic atașat nu e o ofertă de materiale)", () => {
    expect(validateMaterialOfferInput({ message: "Bună", files: [] })).toEqual({
      ok: false,
      error: "NO_FILES",
    });
  });

  it("peste MAX_MATERIAL_FILES_PER_OFFER fișiere → TOO_MANY_FILES", () => {
    const files = Array.from({ length: 11 }, (_, i) => ({ ...validFile, fileName: `f${i}.pdf` }));
    expect(validateMaterialOfferInput({ message: "Bună", files })).toEqual({
      ok: false,
      error: "TOO_MANY_FILES",
    });
  });

  it("URL care NU e din propriul store Blob → INVALID_FILE (nu orice URL arbitrar)", () => {
    const res = validateMaterialOfferInput({
      message: "Bună",
      files: [{ ...validFile, url: "https://evil.example.com/f.pdf" }],
    });
    expect(res).toEqual({ ok: false, error: "INVALID_FILE" });
  });

  it("fileName gol → INVALID_FILE", () => {
    const res = validateMaterialOfferInput({ message: "Bună", files: [{ ...validFile, fileName: "  " }] });
    expect(res).toEqual({ ok: false, error: "INVALID_FILE" });
  });

  it("fileSize negativ/zero/non-finit → INVALID_FILE", () => {
    for (const fileSize of [0, -1, Infinity, NaN, 1e308]) {
      expect(validateMaterialOfferInput({ message: "Bună", files: [{ ...validFile, fileSize }] })).toEqual({
        ok: false,
        error: "INVALID_FILE",
      });
    }
  });

  it("fișier valid → trece", () => {
    expect(validateMaterialOfferInput({ message: "Bună", files: [validFile] })).toEqual({
      ok: true,
      message: "Bună",
      files: [validFile],
    });
  });
});
