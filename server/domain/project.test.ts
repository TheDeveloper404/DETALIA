import { describe, expect, it } from "vitest";

import {
  canReleaseToCommunity,
  formatShareTimestamp,
  hasProjectAccess,
  PROJECT_NAME_MAX_LENGTH,
  resolveDetailPlacement,
  validateProjectName,
} from "./project";

describe("resolveDetailPlacement — un detaliu stă mereu într-un singur loc din trei", () => {
  it("status DRAFT (indiferent de projectId) → DRAFT", () => {
    expect(resolveDetailPlacement({ status: "DRAFT", projectId: null })).toBe("DRAFT");
    expect(resolveDetailPlacement({ status: "DRAFT", projectId: "p1" })).toBe("DRAFT");
  });

  it("PUBLISHED + projectId setat → PROJECT (vizibil doar membrilor)", () => {
    expect(resolveDetailPlacement({ status: "PUBLISHED", projectId: "p1" })).toBe("PROJECT");
  });

  it("PUBLISHED + projectId null → COMMUNITY (public, ca azi)", () => {
    expect(resolveDetailPlacement({ status: "PUBLISHED", projectId: null })).toBe("COMMUNITY");
  });
});

describe("hasProjectAccess — poarta de acces la un proiect", () => {
  it("owner, fără rând de membru → acces", () => {
    expect(hasProjectAccess({ isOwner: true, isActiveMember: false })).toBe(true);
  });

  it("membru activ, nu owner → acces", () => {
    expect(hasProjectAccess({ isOwner: false, isActiveMember: true })).toBe(true);
  });

  it("nici owner, nici membru activ → refuz", () => {
    expect(hasProjectAccess({ isOwner: false, isActiveMember: false })).toBe(false);
  });

  it("membru eliminat (isActiveMember=false) și nu owner → refuz, chiar dacă a fost membru cândva", () => {
    expect(hasProjectAccess({ isOwner: false, isActiveMember: false })).toBe(false);
  });
});

describe("canReleaseToCommunity — regula «orfan»", () => {
  it("autorul detaliului → poate oricând, indiferent de owner", () => {
    expect(
      canReleaseToCommunity({ isDetailAuthor: true, isProjectOwner: false, authorIsActiveMember: true }),
    ).toBe(true);
  });

  it("owner-ul proiectului, autorul ÎNCĂ membru activ → refuz (nu e moderare, e decizia autorului)", () => {
    expect(
      canReleaseToCommunity({ isDetailAuthor: false, isProjectOwner: true, authorIsActiveMember: true }),
    ).toBe(false);
  });

  it("owner-ul proiectului, autorul NU mai e membru activ → poate (detaliu orfan)", () => {
    expect(
      canReleaseToCommunity({ isDetailAuthor: false, isProjectOwner: true, authorIsActiveMember: false }),
    ).toBe(true);
  });

  it("nici autor, nici owner → refuz, indiferent de statusul de membru al autorului", () => {
    expect(
      canReleaseToCommunity({ isDetailAuthor: false, isProjectOwner: false, authorIsActiveMember: false }),
    ).toBe(false);
  });
});

describe("validateProjectName", () => {
  it("nume valid, cu spații la capete → trim", () => {
    const res = validateProjectName("  Renovare bloc A  ");
    expect(res).toEqual({ ok: true, value: "Renovare bloc A" });
  });

  it("gol sau doar spații → EMPTY", () => {
    expect(validateProjectName("")).toEqual({ ok: false, error: "EMPTY" });
    expect(validateProjectName("   ")).toEqual({ ok: false, error: "EMPTY" });
  });

  it("nu e string → EMPTY", () => {
    expect(validateProjectName(undefined)).toEqual({ ok: false, error: "EMPTY" });
    expect(validateProjectName(123)).toEqual({ ok: false, error: "EMPTY" });
  });

  it(`peste ${PROJECT_NAME_MAX_LENGTH} caractere → TOO_LONG`, () => {
    const res = validateProjectName("a".repeat(PROJECT_NAME_MAX_LENGTH + 1));
    expect(res).toEqual({ ok: false, error: "TOO_LONG" });
  });

  it(`exact ${PROJECT_NAME_MAX_LENGTH} caractere → valid (limita e inclusă)`, () => {
    const name = "a".repeat(PROJECT_NAME_MAX_LENGTH);
    expect(validateProjectName(name)).toEqual({ ok: true, value: name });
  });
});

// Bug real 2026-08-16 (raportat): fără `timeZone` explicit, `Date.get*()` citește ora
// runtime-ului serverului (Vercel = UTC), nu ora Bucureștiului — numele partajării arăta mereu cu
// 2-3 ore în urmă. Verificăm EXPLICIT ambele reguli DST (vara = +3, iarna = +2), nu doar o dată.
describe("formatShareTimestamp", () => {
  it("vara (EEST, UTC+3): 16 aug 10:00 UTC → 13:00 București", () => {
    expect(formatShareTimestamp(new Date("2026-08-16T10:00:00.000Z"))).toBe("16.08.2026 13:00");
  });

  it("iarna (EET, UTC+2): 16 ian 10:00 UTC → 12:00 București", () => {
    expect(formatShareTimestamp(new Date("2026-01-16T10:00:00.000Z"))).toBe("16.01.2026 12:00");
  });

  it("trece de miezul nopții în ora locală: 16 aug 22:30 UTC → 17 aug 01:30 București", () => {
    expect(formatShareTimestamp(new Date("2026-08-16T22:30:00.000Z"))).toBe("17.08.2026 01:30");
  });
});
