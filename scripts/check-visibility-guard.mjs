#!/usr/bin/env node
// Gardă mecanică pentru clasa de bug „invariant transversal nou" (CLAUDE.md, feature „Proiect": 14
// goluri reale în 6 runde de review, 2026-08-09) — o funcție de repo NOUĂ care citește tabela `details`
// pentru o listare/agregare publică (feed, profil, autori de top, statistici) fără să excludă explicit
// detaliile de proiect (`isNull(details.projectId)` / `hasProjectAccessForUser`) le expune unui user
// fără acces (ex. un membru eliminat din proiect). Completează sink-tracing-ul de scriere
// (check:blob-writes, SEC-N01) cu echivalentul lui pe partea de CITIRE/vizibilitate — recomandare din
// discuția de audit 2026-08-21 (skill-ul security-audit are sink-tracing pt sink-uri de acțiune, nu
// avea încă un guard mecanic pt invariantul de vizibilitate).
//
// Rulat în CI (npm run check:visibility) — mirror-uiește exact scripts/check-blob-write-guard.mjs.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findViolations, RISKY_FILES } from "./visibility-guard-check.lib.mjs";

const REPOS_DIR = join(process.cwd(), "server", "repos");
const BASELINE_PATH = join(process.cwd(), "scripts", "visibility-guard-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function checkFile(filePath) {
  return findViolations(readFileSync(filePath, "utf8"));
}

const current = {};

for (const file of RISKY_FILES) {
  const filePath = join(REPOS_DIR, file);
  if (!existsSync(filePath)) continue;
  const violations = checkFile(filePath);
  for (const v of violations) {
    current[`${file}::${v.functionName}`] = { ...v, file };
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
    `\n✖ server/repos/${v.file}:~${v.lineNumber} — funcția "${v.functionName}" atinge tabela "details" ` +
      `FĂRĂ nicio gardă de scopare pe proiect (isNull(details.projectId)/hasProjectAccessForUser/` +
      `eq(details.projectId, ...)/canAccessProjectDetail) în același corp de funcție.\n` +
      `  Dacă e o listare/agregare PUBLICĂ (feed/profil/rail/statistici), un detaliu de proiect (privat) ` +
      `ar putea apărea acolo neintenționat — ex. un membru eliminat din proiect tot vede titlul/imaginea.\n` +
      `  Fix: adaugă isNull(details.projectId) (sau hasProjectAccessForUser(userId) dacă funcția e per-user) ` +
      `în WHERE.\n` +
      `  Context: ${v.snippet}…`,
  );
}

if (newViolations.length > 0) {
  console.error(
    `\n${newViolations.length} funcție(i) NOUĂ(E) care ating "details" fără gardă de vizibilitate. Vezi ` +
      `detalii mai sus.\n` +
      `Dacă e fals-pozitiv verificat (funcție internă de proiect deja scopată la un singur projectId de ` +
      `apelant, sau lookup pe un id cunoscut unde gate-ul e în service, ex. getDetailById), rulează ` +
      `\`node scripts/check-visibility-guard.mjs --update-baseline\` după ce confirmi manual.\n`,
  );
  process.exit(1);
}

console.log(
  `OK — ${RISKY_FILES.length} fișiere din server/repos verificate, nicio funcție NOUĂ care citește ` +
    `"details" fără gardă de vizibilitate (${Object.keys(baseline).length} instanțe pre-existente în ` +
    `baseline, verificate manual — vezi visibility-guard-baseline.json).`,
);
