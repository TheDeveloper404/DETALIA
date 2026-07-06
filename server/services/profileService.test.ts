import { describe, expect, it } from "vitest";

import { roleLabelOf } from "./profileService";

// Convenție platformă: doar meseria (subRole) se afișează, NU domeniul (roleMain) — decizie Edi,
// unificată 2026-07-06 (era aplicată inconsecvent: edit-profile corect, profil/feed/rail arătau domeniul).

describe("roleLabelOf", () => {
  it("cu subRole → întoarce DOAR meseria, fără domeniu", () => {
    expect(roleLabelOf("PROIECTANT", "Arhitect")).toBe("Arhitect");
  });

  it("fără subRole → fallback pe eticheta domeniului (nu ar trebui să apară în practică, subRole e obligatoriu la onboarding)", () => {
    expect(roleLabelOf("PROIECTANT", null)).toBe("Proiectare");
  });

  it("fără roleMain → Rol nedeclarat", () => {
    expect(roleLabelOf(null, null)).toBe("Rol nedeclarat");
  });
});
