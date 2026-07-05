// Poartă de securitate CI pe dependințe: blochează PR-ul la orice vulnerabilitate HIGH/CRITICAL,
// CU EXCEPȚIA advisory-urilor din allowlist-ul de mai jos (risk-acceptance documentat).
//
// Rulează `npm audit --json` și eșuează (exit 1) dacă rămâne vreun high/critical neacceptat.
// Înlocuiește `npm audit --audit-level=high` ca să putem accepta țintit un high fără fix upstream,
// PĂSTRÂND poarta strictă pentru orice alt high/critical nou. Vezi docs/SECURITATE.md.
import { execFileSync } from "node:child_process";

// Advisory-uri HIGH acceptate explicit (GHSA). Fiecare intrare = risk-acceptance cu motiv.
const ALLOWLIST = new Map([]);

const BLOCKING = new Set(["high", "critical"]);
const ghsaFromUrl = (url) => (typeof url === "string" ? url.split("/advisories/")[1] ?? url : "");

let report;
try {
  // `npm audit --json` întoarce exit code ≠ 0 când găsește vulnerabilități → capturăm stdout din eroare.
  // Argumente ca array (fără interpolare de input). `shell` doar pe Windows local (npm = npm.cmd, spawn direct
  // dă EINVAL); pe CI (Linux) rulează fără shell. Comanda e un literal fix → fără suprafață de injecție.
  const out = execFileSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: process.platform === "win32",
  });
  report = JSON.parse(out);
} catch (err) {
  if (!err.stdout) {
    console.error("audit-check: nu am putut rula `npm audit --json`:", err.message);
    process.exit(2);
  }
  report = JSON.parse(err.stdout);
}

// npm v7+ : report.vulnerabilities[pkg].via[] conține fie stringuri (tranzitiv), fie obiecte-advisory.
const blocking = [];
const accepted = [];
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
    const ghsa = ghsaFromUrl(via.url);
    if (ALLOWLIST.has(ghsa)) accepted.push(`${ghsa} (${via.title ?? via.name})`);
    else blocking.push(`${via.severity.toUpperCase()} ${ghsa || via.source} — ${via.title ?? via.name}`);
  }
}

if (accepted.length) {
  console.log("audit-check: high/critical ACCEPTATE (allowlist, risk-acceptance):");
  for (const a of new Set(accepted)) console.log("  ✓", a);
}

if (blocking.length) {
  console.error("\naudit-check: high/critical NEACCEPTATE — PR blocat:");
  for (const b of new Set(blocking)) console.error("  ✖", b);
  console.error("\nRezolvă (upgrade/override) sau, dacă e risk-acceptance justificat, adaugă GHSA în ALLOWLIST din scripts/audit-check.mjs.");
  process.exit(1);
}

console.log("audit-check: nicio vulnerabilitate high/critical neacceptată. OK.");
