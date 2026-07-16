import { describe, expect, it } from "vitest";

import {
  ROLE_MAIN_LABELS,
  ROLE_MAINS,
  SECONDARY_ROLES,
  SUBROLES,
  isValidRoleMain,
  isValidSecondaryRole,
  isValidSubRole,
} from "./roles";

describe("isValidRoleMain — allowlist rol principal", () => {
  it("acceptă valorile din ROLE_MAINS", () => {
    for (const r of ROLE_MAINS) expect(isValidRoleMain(r)).toBe(true);
  });

  it("respinge orice altă valoare (case-sensitive, fără injectare de rol nou)", () => {
    expect(isValidRoleMain("ADMIN")).toBe(false);
    expect(isValidRoleMain("proiectant")).toBe(false);
    expect(isValidRoleMain("")).toBe(false);
  });
});

describe("isValidSubRole — meseria trebuie să aparțină rolului principal ales", () => {
  it("acceptă orice meserie din lista rolului corect", () => {
    for (const roleMain of ROLE_MAINS) {
      for (const subRole of SUBROLES[roleMain]) {
        expect(isValidSubRole(roleMain, subRole)).toBe(true);
      }
    }
  });

  it("respinge o meserie validă dar sub alt rol principal (nu poți amesteca listele)", () => {
    expect(isValidSubRole("PROIECTANT", "Electrician")).toBe(false); // Electrician e la EXECUTANT
    expect(isValidSubRole("EXECUTANT", "Arhitect")).toBe(false); // Arhitect e la PROIECTANT
  });

  it("respinge meserie inventată/neexistentă", () => {
    expect(isValidSubRole("PROIECTANT", "Vrăjitor")).toBe(false);
  });
});

describe("isValidSecondaryRole — rol adițional (Administrativ/Educație), aditiv peste meserie", () => {
  it("acceptă valorile din SECONDARY_ROLES", () => {
    for (const r of SECONDARY_ROLES) expect(isValidSecondaryRole(r)).toBe(true);
  });

  it("respinge o meserie de bază folosită ca rol adițional (liste separate)", () => {
    expect(isValidSecondaryRole("Arhitect")).toBe(false);
  });

  it("respinge valoare inventată", () => {
    expect(isValidSecondaryRole("Super Admin")).toBe(false);
  });
});

describe("restructurare roluri 2026-07-16 (cerere Edi)", () => {
  it("Diriginte de șantier / RTE au fost mutate din EXECUTANT (subrol) în Rol adițional", () => {
    expect(isValidSubRole("EXECUTANT", "Diriginte de șantier")).toBe(false);
    expect(isValidSubRole("EXECUTANT", "RTE")).toBe(false);
    expect(isValidSecondaryRole("Diriginte de șantier")).toBe(true);
    expect(isValidSecondaryRole("RTE")).toBe(true);
  });

  it("subrolurile noi de EXECUTANT sunt valide", () => {
    expect(isValidSubRole("EXECUTANT", "Tâmplar mobilă")).toBe(true);
    expect(isValidSubRole("EXECUTANT", "Montator învelitori")).toBe(true);
    expect(isValidSubRole("EXECUTANT", "Montator hidroizolații")).toBe(true);
  });

  it("FURNIZOR se afișează acum ca „Achiziții materiale” (label de grupare la signup)", () => {
    expect(ROLE_MAIN_LABELS.FURNIZOR).toBe("Achiziții materiale");
  });

  it("„Beneficiar documentat” a devenit simplu „Beneficiar”", () => {
    expect(isValidSubRole("BENEFICIAR", "Beneficiar")).toBe(true);
    expect(isValidSubRole("BENEFICIAR", "Beneficiar documentat")).toBe(false);
  });

  it("Specialist Case Pasive / Specialist nZEB sunt roluri adiționale valide", () => {
    expect(isValidSecondaryRole("Specialist Case Pasive")).toBe(true);
    expect(isValidSecondaryRole("Specialist nZEB")).toBe(true);
  });
});
