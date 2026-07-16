import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCATION,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
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

describe("validateDetailInput — locație (2026-07-16, pill România / Altă locație)", () => {
  it("fără locație → implicit România, context tehnic valabil", () => {
    const r = validateDetailInput({ ...base, seismicAg: "0.20g" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.location).toBe(DEFAULT_LOCATION);
      expect(r.value.seismicAg).toBe("0.20g");
    }
  });

  it("locație explicit România → identic cu implicit", () => {
    const r = validateDetailInput({ ...base, location: "România", climateZone: "Zona II" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.climateZone).toBe("Zona II");
  });

  it("locație non-România → OK, dar context tehnic FORȚAT la neutru chiar dacă clientul trimite valori RO", () => {
    // SEC: un POST direct (nu prin UI, care ascunde câmpurile) nu trebuie să poată strecura o
    // clasificare românească pe un detaliu din altă țară.
    const r = validateDetailInput({
      ...base,
      location: "Italia, Roma",
      climateZone: "Zona II",
      seismicAg: "0.20g",
      seismicTc: "1.0s",
      snowLoad: "sk 2.0",
      windLoad: "qb 0.5",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.location).toBe("Italia, Roma");
      expect(r.value.climateZone).toBeNull();
      expect(r.value.seismicAg).toBe("General");
      expect(r.value.seismicTc).toBe("General");
      expect(r.value.snowLoad).toBe("General");
      expect(r.value.windLoad).toBe("General");
    }
  });

  it("locație goală explicit LA PUBLICARE (strict) → LOCATION_REQUIRED (nu cade silențios pe România)", () => {
    expect(validateDetailInput({ ...base, location: "   " })).toEqual({
      ok: false,
      error: "LOCATION_REQUIRED",
    });
  });

  // Regresie (bug găsit la code-review 2026-07-16): LOCATION_REQUIRED rula necondiționat, inclusiv pe
  // CIORNĂ (strict:false) — un user care alegea pillul „Altă locație" fără să apuce să scrie textul nu
  // mai putea salva ciorna deloc, deși ciorna tolerează totul în afară de titlu.
  it("locație goală explicit LA CIORNĂ (strict:false) → NU blochează, cade pe România implicit", () => {
    const r = validateDetailInput({ ...base, location: "" }, { strict: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.location).toBe(DEFAULT_LOCATION);
  });

  it("respinge locație peste LOCATION_MAX_LENGTH", () => {
    expect(
      validateDetailInput({ ...base, location: "x".repeat(LOCATION_MAX_LENGTH + 1) }),
    ).toEqual({ ok: false, error: "LOCATION_TOO_LONG" });
  });
});

// „Salvează ciornă" (2026-07-06) — strict:false relaxează imagine/categorie, titlul rămâne obligatoriu
// (altfel ciorna n-ar avea cum să apară listată în „Ciornele mele").
describe("validateDetailInput — strict:false (CIORNĂ)", () => {
  const draftBase = { title: "Ciornă în lucru", categoryIds: [], imageUrl: null };

  it("titlul rămâne obligatoriu chiar și la ciornă", () => {
    expect(validateDetailInput({ ...draftBase, title: "  " }, { strict: false })).toEqual({
      ok: false,
      error: "TITLE_REQUIRED",
    });
  });

  it("acceptă fără categorie și fără imagine", () => {
    const r = validateDetailInput(draftBase, { strict: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.categoryIds).toEqual([]);
      expect(r.value.imageUrl).toBeNull();
    }
  });

  it("dacă imaginea/categoria SUNT date, tot se validează formatul/plafoanele", () => {
    const categoryIds = Array.from({ length: MAX_DETAIL_CATEGORIES + 1 }, (_, i) => `cat-${i}`);
    expect(validateDetailInput({ ...draftBase, categoryIds }, { strict: false })).toEqual({
      ok: false,
      error: "TOO_MANY_CATEGORIES",
    });
  });

  it("strict (implicit) tot cere imagine + categorie — comportamentul vechi neschimbat", () => {
    expect(validateDetailInput(draftBase)).toEqual({ ok: false, error: "CATEGORY_REQUIRED" });
  });
});
