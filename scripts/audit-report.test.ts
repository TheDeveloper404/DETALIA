import { describe, expect, it } from "vitest";

// Modul .mjs de CI (fără declarații de tip proprii) — importat direct, ca testul să acopere exact
// codul care rulează în pipeline, nu o copie.
import { classifyFindings, isValidAuditReport } from "./audit-report.mjs";

const ALLOWLIST = new Map([["GHSA-aaaa-bbbb-cccc", "motiv de risk-acceptance"]]);

function advisory(severity: string, ghsa: string, title = "ceva") {
  return { severity, title, url: `https://github.com/advisories/${ghsa}` };
}

function report(vulns: Record<string, unknown>) {
  return { vulnerabilities: vulns, metadata: { vulnerabilities: { high: 0, critical: 0 } } };
}

describe("isValidAuditReport — poarta NU are voie să raporteze curat fără să fi verificat", () => {
  it("raport npm audit valid (chiar și gol) → acceptat", () => {
    expect(isValidAuditReport(report({}))).toBe(true);
  });

  it("raport de EROARE al npm (fără `vulnerabilities`) → respins", () => {
    // Exact forma pe care npm o scrie pe stdout când auditul nu poate rula (rețea/registry).
    expect(isValidAuditReport({ error: { code: "ENETUNREACH", summary: "network error" } })).toBe(false);
  });

  it("raport fără `metadata` → respins (structură incompletă)", () => {
    expect(isValidAuditReport({ vulnerabilities: {} })).toBe(false);
  });

  it("null / string / undefined → respinse", () => {
    expect(isValidAuditReport(null)).toBe(false);
    expect(isValidAuditReport("{}")).toBe(false);
    expect(isValidAuditReport(undefined)).toBe(false);
  });
});

describe("classifyFindings", () => {
  it("HIGH/CRITICAL neacceptate → blocante; cele din allowlist → acceptate", () => {
    const r = report({
      pkgA: { via: [advisory("high", "GHSA-1111-2222-3333", "chestie gravă")] },
      pkgB: { via: [advisory("critical", "GHSA-9999-8888-7777")] },
      pkgC: { via: [advisory("high", "GHSA-aaaa-bbbb-cccc")] },
    });

    const { blocking, accepted } = classifyFindings(r, ALLOWLIST);

    expect(blocking).toHaveLength(2);
    expect(blocking.join(" ")).toContain("GHSA-1111-2222-3333");
    expect(blocking.join(" ")).toContain("GHSA-9999-8888-7777");
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toContain("GHSA-aaaa-bbbb-cccc");
  });

  it("severitățile sub HIGH nu blochează", () => {
    const r = report({ pkgA: { via: [advisory("moderate", "GHSA-1111-2222-3333")] } });
    expect(classifyFindings(r, ALLOWLIST).blocking).toHaveLength(0);
  });

  it("`via` cu stringuri (dependență tranzitivă) se ignoră, fără să crape", () => {
    const r = report({ pkgA: { via: ["altPachet"] } });
    expect(classifyFindings(r, ALLOWLIST).blocking).toHaveLength(0);
  });

  it("același advisory prin mai multe pachete apare O SINGURĂ dată", () => {
    const dup = advisory("high", "GHSA-1111-2222-3333", "duplicat");
    const r = report({ pkgA: { via: [dup] }, pkgB: { via: [dup] } });
    expect(classifyFindings(r, ALLOWLIST).blocking).toHaveLength(1);
  });
});
