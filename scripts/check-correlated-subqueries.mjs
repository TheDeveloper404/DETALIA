#!/usr/bin/env node
// Gardă mecanică pentru bug-ul recurent (3x, ultima cu impact real în producție — vezi
// docs/INCIDENTS.md și CLAUDE.md §„Capcane tehnice"): un subquery corelat Drizzle care referă o
// coloană a tabelului EXTERIOR fără calificare explicită (`sql.identifier`) se rezolvă de Postgres la
// coloana omonimă din tabelul PROPRIU al subquery-ului (dacă există), nu la exterior — condiție mereu
// falsă/adevărată, SILENȚIOS, fără eroare SQL.
//
// Detectează: în interiorul unui template `sql`...`` care conține un `select ... from ${tabelA} ...`
// (deci e un subquery corelat), orice interpolare `${tabelB.coloana}` unde `tabelB` diferă de
// `tabelA` (tabelul propriu al subquery-ului) — asta e exact pattern-ul periculos. Fix corect:
// pre-calificare explicită cu `sql.identifier("tabel")` într-o constantă (vezi `detailsId` din
// server/repos/detailsRepo.ts / profileRepo.ts), interpolată apoi ca `${detailsId}` (fără punct).
//
// Rulat în CI (npm run check:subqueries) — nu înlocuiește gândirea, dar nu se poate „uita" ca disciplina manuală.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findViolations } from "./correlated-subquery-check.lib.mjs";

const REPOS_DIR = join(process.cwd(), "server", "repos");
const BASELINE_PATH = join(process.cwd(), "scripts", "correlated-subquery-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function checkFile(filePath) {
  return findViolations(readFileSync(filePath, "utf8"));
}

// Model verificat direct cu .toSQL() (2026-08-07): Drizzle scapă calificarea de tabel pe `sql``
// atunci când query-ul exterior N-ARE join — dar politica din cod (vezi comentariul `detailsId` din
// profileRepo.ts) e să califici EXPLICIT mereu, indiferent de join, tocmai fiindcă a te baza pe
// detaliul ăsta intern e fragil (același fragment poate fi refolosit ulterior într-un context fără
// join). Regula strictă de mai jos prinde deci și cazuri azi „accidental sigure" — corect filozofic,
// dar prea multe pt un fix punctual pe cod vechi neatins. De-aia: BASELINE, nu blocare totală —
// CI pică doar pe instanțe NOI, nu pe cele deja existente (needrevizuite separat, nu în scope aici).
const files = readdirSync(REPOS_DIR).filter((f) => f.endsWith(".ts"));
const current = {};

for (const file of files) {
  const filePath = join(REPOS_DIR, file);
  const violations = checkFile(filePath);
  const seen = new Map();
  for (const v of violations) {
    const baseKey = `${file}::${v.ownTable}::${v.table}.${v.column}`;
    const occurrence = seen.get(baseKey) ?? 0;
    seen.set(baseKey, occurrence + 1);
    current[`${baseKey}::${occurrence}`] = { ...v, file };
  }
}

if (updateBaseline) {
  const baseline = Object.fromEntries(Object.keys(current).map((k) => [k, true]));
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`Baseline actualizat — ${Object.keys(baseline).length} instanțe înghețate în ${BASELINE_PATH}.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
const newViolations = Object.entries(current).filter(([key]) => !baseline[key]);

for (const [, v] of newViolations) {
  console.error(
    `\n✖ server/repos/${v.file}:~${v.lineNumber} — subquery corelat NOU pe "${v.ownTable}" referă ` +
      `"\${${v.table}.${v.column}}" NECALIFICAT (tabel diferit de FROM-ul subquery-ului).\n` +
      `  Postgres poate rezolva asta la coloana proprie a subquery-ului dacă există una omonimă — ` +
      `condiție mereu falsă/adevărată, silențios (bug recurent 3x, vezi CLAUDE.md).\n` +
      `  Fix: pre-califică cu sql.identifier(...) într-o constantă (vezi \`detailsId\` în detailsRepo.ts) ` +
      `și interpolează constanta, nu \${${v.table}.${v.column}} direct.\n` +
      `  Context: ${v.snippet}…`,
  );
}

if (newViolations.length > 0) {
  console.error(
    `\n${newViolations.length} subquery(uri) corelat(e) NOI, necalificate. Vezi detalii mai sus.\n` +
      `Dacă e fals-pozitiv verificat (join prezent, .toSQL() confirmă calificare corectă), rulează ` +
      `\`node scripts/check-correlated-subqueries.mjs --update-baseline\` după ce confirmi manual.\n`,
  );
  process.exit(1);
}

console.log(
  `OK — ${files.length} fișiere din server/repos verificate, niciun subquery corelat NOU necalificat ` +
    `(${Object.keys(baseline).length} instanțe pre-existente în baseline, needevizuite separat).`,
);
