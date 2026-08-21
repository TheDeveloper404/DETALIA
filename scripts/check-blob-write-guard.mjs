#!/usr/bin/env node
// Gardă mecanică pentru clasa de bug SEC-N01 (audit securitate 2026-08-20, docs/CHANGELOG.md 2026-08-20
// (IV)): o funcție de service care persistă un URL de Blob (resursă/imagine/avatar/comentariu) fără să
// verifice întâi ownership-ul (`isUsersBlobUrl`/`hasForeignBlobResource`/`reprocessBlobImage`) permite
// unui user să atașeze URL-ul altui user pe conținut propriu — la ștergere, fișierul VICTIMEI dispare
// din Blob. Gaura a stat nedetectată ~2 luni pentru că niciun audit anterior n-a urmărit sistematic
// fiecare write-path de acest tip. Asta transformă disciplina „nu uita gardul" într-un check care nu
// se poate uita.
//
// Rulat în CI (npm run check:blob-writes) — mirror-uiește exact scripts/check-correlated-subqueries.mjs.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findViolations } from "./blob-write-guard-check.lib.mjs";

const SERVICES_DIR = join(process.cwd(), "server", "services");
const BASELINE_PATH = join(process.cwd(), "scripts", "blob-write-guard-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function checkFile(filePath) {
  return findViolations(readFileSync(filePath, "utf8"));
}

const files = readdirSync(SERVICES_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const current = {};

for (const file of files) {
  const filePath = join(SERVICES_DIR, file);
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
    `\n✖ server/services/${v.file}:~${v.lineNumber} — funcția "${v.functionName}" apelează sink-ul de ` +
      `scriere Blob "${v.sink}(...)" FĂRĂ nicio gardă de ownership (isUsersBlobUrl/hasForeignBlobResource/` +
      `reprocessBlobImage) în același corp de funcție.\n` +
      `  Un URL din store-ul nostru dar al altui user ar putea fi persistat necontrolat — la ștergerea ` +
      `conținutului, fișierul acelui user dispare din Blob (SEC-N01, vezi CHANGELOG 2026-08-20).\n` +
      `  Fix: verifică ownership-ul URL-ului (isUsersBlobUrl(url, userId) sau reprocessBlobImage) ÎNAINTE ` +
      `de a-l pasa la "${v.sink}".\n` +
      `  Context: ${v.snippet}…`,
  );
}

if (newViolations.length > 0) {
  console.error(
    `\n${newViolations.length} funcție(i) NOUĂ(E) care scriu un URL de Blob fără gardă. Vezi detalii mai sus.\n` +
      `Dacă e fals-pozitiv verificat (URL-ul nu vine niciodată de la client, ex. ștergere cu literal null, ` +
      `sau upload proaspăt server-side, nu string de la client), rulează ` +
      `\`node scripts/check-blob-write-guard.mjs --update-baseline\` după ce confirmi manual.\n`,
  );
  process.exit(1);
}

console.log(
  `OK — ${files.length} fișiere din server/services verificate, nicio funcție NOUĂ care scrie un URL de ` +
    `Blob fără gardă de ownership (${Object.keys(baseline).length} instanțe pre-existente în baseline, ` +
    `verificate manual — vezi comentariile din blob-write-guard-baseline.json / profileService.ts removeAvatar/removeCover).`,
);
