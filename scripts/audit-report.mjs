// Logica PURĂ a porții de audit, separată de execuția `npm audit` ca să fie testabilă fără rețea.
// `scripts/audit-check.mjs` o folosește; testele o acoperă direct (scripts/audit-report.test.ts).

export const BLOCKING = new Set(["high", "critical"]);

export const ghsaFromUrl = (url) =>
  typeof url === "string" ? url.split("/advisories/")[1] ?? url : "";

// Un raport `npm audit --json` VALID conține întotdeauna `vulnerabilities` (obiect, gol când nu e nimic)
// ȘI `metadata.vulnerabilities` (contoare). Când `npm audit` eșuează (rețea, rate-limit de registry,
// registry privat indisponibil) scrie pe stdout un JSON de EROARE, fără câmpurile astea.
//
// DE CE contează: varianta veche făcea `report.vulnerabilities ?? {}` — un raport de eroare producea
// zero vulnerabilități găsite, deci „OK", deci PR verde. Adică poarta raporta „curat" exact în cazul
// în care nu putuse verifica nimic (fail-open). S-a întâmplat REAL pe 2026-08-06: două rulări CI pe
// ACELAȘI commit, una a blocat 4 HIGH, cealaltă a trecut cu „nicio vulnerabilitate".
export function isValidAuditReport(report) {
  if (!report || typeof report !== "object") return false;
  if (typeof report.vulnerabilities !== "object" || report.vulnerabilities === null) return false;
  return typeof report.metadata?.vulnerabilities === "object";
}

// Împarte advisory-urile HIGH/CRITICAL în „blocante" și „acceptate” (allowlist de risk-acceptance).
export function classifyFindings(report, allowlist) {
  const blocking = [];
  const accepted = [];
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
      const ghsa = ghsaFromUrl(via.url);
      if (allowlist.has(ghsa)) accepted.push(`${ghsa} (${via.title ?? via.name})`);
      else blocking.push(`${via.severity.toUpperCase()} ${ghsa || via.source} — ${via.title ?? via.name}`);
    }
  }
  return { blocking: [...new Set(blocking)], accepted: [...new Set(accepted)] };
}
