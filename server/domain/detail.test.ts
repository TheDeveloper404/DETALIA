import { describe, expect, it } from "vitest";

import {
  DESCRIPTION_MAX_LENGTH,
  MAX_DETAIL_CATEGORIES,
  MAX_DETAIL_RESOURCES,
  MAX_RESOURCE_URL_LENGTH,
  TITLE_MAX_LENGTH,
  isHttpUrl,
  validateDetailInput,
} from "./detail";

const base = {
  title: "Atic la acoperiș terasă",
  categoryIds: ["cat-1"],
  imageUrl: "https://x.public.blob.vercel-storage.com/details/a.png",
};

describe("isHttpUrl — allowlist strict (valoarea ajunge în href)", () => {
  it("acceptă http/https", () => {
    expect(isHttpUrl("https://exemplu.ro")).toBe(true);
    expect(isHttpUrl("http://exemplu.ro")).toBe(true);
  });

  it("blochează scheme periculoase", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,<script>")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("validateDetailInput — server-side, sursa de adevăr", () => {
  it("cere titlu", () => {
    expect(validateDetailInput({ ...base, title: "   " })).toEqual({
      ok: false,
      error: "TITLE_REQUIRED",
    });
  });

  it("respinge titlu prea lung", () => {
    expect(validateDetailInput({ ...base, title: "x".repeat(TITLE_MAX_LENGTH + 1) }).ok).toBe(false);
  });

  it("cere imagine și categorie", () => {
    expect(validateDetailInput({ ...base, imageUrl: "" })).toEqual({
      ok: false,
      error: "IMAGE_REQUIRED",
    });
    expect(validateDetailInput({ ...base, categoryIds: [] })).toEqual({
      ok: false,
      error: "CATEGORY_REQUIRED",
    });
  });

  it("respinge peste MAX_DETAIL_CATEGORIES", () => {
    const categoryIds = Array.from({ length: MAX_DETAIL_CATEGORIES + 1 }, (_, i) => `cat-${i}`);
    expect(validateDetailInput({ ...base, categoryIds })).toEqual({
      ok: false,
      error: "TOO_MANY_CATEGORIES",
    });
  });

  it("respinge peste MAX_DETAIL_RESOURCES", () => {
    const resources = Array.from({ length: MAX_DETAIL_RESOURCES + 1 }, () => ({
      type: "LINK" as const,
      url: "https://exemplu.ro",
    }));
    expect(validateDetailInput({ ...base, resources })).toEqual({
      ok: false,
      error: "TOO_MANY_RESOURCES",
    });
  });

  it("respinge resursă cu URL periculos (allowlist la INPUT, nu doar la randare)", () => {
    expect(
      validateDetailInput({ ...base, resources: [{ type: "LINK", url: "javascript:alert(1)" }] }),
    ).toEqual({ ok: false, error: "INVALID_RESOURCE" });
  });

  it("respinge tip de resursă necunoscut", () => {
    expect(
      validateDetailInput({
        ...base,
        resources: [{ type: "EXE" as never, url: "https://exemplu.ro" }],
      }),
    ).toEqual({ ok: false, error: "INVALID_RESOURCE" });
  });

  it("TEXT cere body, nu URL", () => {
    expect(validateDetailInput({ ...base, resources: [{ type: "TEXT", body: "  " }] })).toEqual({
      ok: false,
      error: "INVALID_RESOURCE",
    });
    const ok = validateDetailInput({ ...base, resources: [{ type: "TEXT", body: "notă" }] });
    expect(ok.ok).toBe(true);
  });

  it("SEC-11: respinge valori de zonă din afara listei fixe (frontend nu e sursă de adevăr)", () => {
    expect(validateDetailInput({ ...base, climateZone: "Zona IX" })).toEqual({
      ok: false,
      error: "INVALID_ZONE",
    });
    expect(validateDetailInput({ ...base, seismicAg: "0.99g" })).toEqual({
      ok: false,
      error: "INVALID_ZONE",
    });
    expect(validateDetailInput({ ...base, seismicTc: "9.9s" })).toEqual({
      ok: false,
      error: "INVALID_ZONE",
    });
    expect(validateDetailInput({ ...base, snowLoad: "sk 9.9" })).toEqual({
      ok: false,
      error: "INVALID_ZONE",
    });
    expect(validateDetailInput({ ...base, windLoad: "qb 9.9" })).toEqual({
      ok: false,
      error: "INVALID_ZONE",
    });
  });

  it("SEC-11: respinge URL de resursă peste limită", () => {
    const longUrl = "https://exemplu.ro/" + "a".repeat(MAX_RESOURCE_URL_LENGTH);
    expect(validateDetailInput({ ...base, resources: [{ type: "LINK", url: longUrl }] })).toEqual({
      ok: false,
      error: "INVALID_RESOURCE",
    });
  });

  it("SEC-11: respinge body TEXT peste limită", () => {
    expect(
      validateDetailInput({
        ...base,
        resources: [{ type: "TEXT", body: "x".repeat(DESCRIPTION_MAX_LENGTH + 1) }],
      }),
    ).toEqual({ ok: false, error: "INVALID_RESOURCE" });
  });

  it("normalizează inputul valid (trim + parametri tehnici default General, climă neafișată dacă lipsă)", () => {
    const r = validateDetailInput({ ...base, title: "  Titlu  ", description: "  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Titlu");
      expect(r.value.description).toBeNull();
      expect(r.value.categoryIds).toEqual(["cat-1"]);
      expect(r.value.climateZone).toBeNull();
      expect(r.value.seismicAg).toBe("General");
      expect(r.value.seismicTc).toBe("General");
      expect(r.value.snowLoad).toBe("General");
      expect(r.value.windLoad).toBe("General");
    }
  });

  it("acceptă valori valide din listele fixe", () => {
    const r = validateDetailInput({
      ...base,
      climateZone: "Zona II",
      seismicAg: "0.20g",
      seismicTc: "1.0s",
      snowLoad: "sk 2.0",
      windLoad: "qb 0.5",
    });
    expect(r.ok).toBe(true);
  });

  it("dedupe categoryIds", () => {
    const r = validateDetailInput({ ...base, categoryIds: ["cat-1", "cat-1", "cat-2"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.categoryIds).toEqual(["cat-1", "cat-2"]);
  });
});
