// Poartă de securitate CI pe dependințe: blochează PR-ul la orice vulnerabilitate HIGH/CRITICAL,
// CU EXCEPȚIA advisory-urilor din allowlist-ul de mai jos (risk-acceptance documentat).
//
// Rulează `npm audit --json` și eșuează (exit 1) dacă rămâne vreun high/critical neacceptat.
// Înlocuiește `npm audit --audit-level=high` ca să putem accepta țintit un high fără fix upstream,
// PĂSTRÂND poarta strictă pentru orice alt high/critical nou. Vezi docs/SECURITATE.md.
import { execFileSync } from "node:child_process";

import { classifyFindings, isValidAuditReport } from "./audit-report.mjs";

// Advisory-uri HIGH acceptate explicit (GHSA). Fiecare intrare = risk-acceptance cu motiv.
const ALLOWLIST = new Map([
  [
    "GHSA-r28c-9q8g-f849",
    "postcss (path traversal via sourceMappingURL): vine din @tailwindcss/postcss/next/shadcn/vite, " +
      "procesează doar CSS-ul propriu din repo la build time, fără sourcemap-uri de la utilizatori. " +
      "Fără fix disponibil upstream. Zero cale spre runtime-ul de producție.",
  ],
]);

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
  try {
    report = JSON.parse(err.stdout);
  } catch {
    console.error("audit-check: `npm audit --json` a scris ceva ce nu e JSON — nu pot verifica nimic.");
    process.exit(2);
  }
}

// FAIL-CLOSED: un raport fără structura așteptată înseamnă că auditul NU a rulat, nu că totul e curat.
// Vezi nota din audit-report.mjs — varianta veche trecea PR-ul în exact acest caz.
if (!isValidAuditReport(report)) {
  console.error(
    "audit-check: raport `npm audit` invalid/incomplet (lipsesc `vulnerabilities`/`metadata`) — " +
      "auditul NU a putut rula. Blochez, ca sa nu raportez curat fara sa fi verificat.",
  );
  if (report?.error) console.error("  detaliu:", report.error.summary ?? report.error.code ?? "necunoscut");
  process.exit(2);
}

const { blocking, accepted } = classifyFindings(report, ALLOWLIST);

if (accepted.length) {
  console.log("audit-check: high/critical ACCEPTATE (allowlist, risk-acceptance):");
  for (const a of accepted) console.log("  ✓", a);
}

if (blocking.length) {
  console.error("\naudit-check: high/critical NEACCEPTATE — PR blocat:");
  for (const b of blocking) console.error("  ✖", b);
  console.error(
    "\nRezolvă (upgrade/override) sau, dacă e risk-acceptance justificat, adaugă GHSA în ALLOWLIST din scripts/audit-check.mjs.",
  );
  process.exit(1);
}

console.log("audit-check: nicio vulnerabilitate high/critical neacceptată. OK.");
