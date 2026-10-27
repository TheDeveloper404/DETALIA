import { describe, expect, it } from "vitest";

import { supportLevel, whatsappUrl } from "./support-contact";

describe("supportLevel", () => {
  // Regula (prototip aprobat): eșec 1 = nimic; eșec 2 = raportare; eșec 3+ = și WhatsApp.
  it.each([
    [0, "none"],
    [1, "none"],
    [2, "report"],
    [3, "whatsapp"],
    [7, "whatsapp"],
  ])("%i eșecuri → %s", (failures, level) => {
    expect(supportLevel(failures)).toBe(level);
  });
});

describe("whatsappUrl", () => {
  it("precompletează pagina și eroarea pe numărul de suport", () => {
    const url = new URL(whatsappUrl({ page: "/details/new", errorMessage: "UPLOAD_FAILED" }));
    expect(url.origin + url.pathname).toBe("https://wa.me/40758154490");
    expect(url.searchParams.get("text")).toBe("Salut, sunt utilizator DETALIA și am o problemă.\nPagina: /details/new\nEroare: UPLOAD_FAILED");
  });

  it("omite rândul de eroare când nu există", () => {
    const url = new URL(whatsappUrl({ page: "/login" }));
    expect(url.searchParams.get("text")).not.toContain("Eroare");
  });
});
