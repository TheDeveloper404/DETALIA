// Logica pură de detecție, separată de CLI (scripts/check-visibility-guard.mjs) — testabilă direct
// (vezi scripts/visibility-guard-check.test.ts) fără acces la disc. Mirror-uiește structura
// scripts/blob-write-guard-check.lib.mjs (aceeași filozofie de gardă mecanică pe un bug recurent).

// Invariantul „detaliu de proiect e privat" (CLAUDE.md §„Un invariant transversal nou...", feature
// „Proiect": 14 goluri reale în 6 runde de review, 2026-08-09) — orice funcție de repo care citește
// tabela `details` pentru o listare/agregare PUBLICĂ (feed, profil, autori de top, statistici) trebuie
// să excludă explicit detaliile de proiect, altfel un membru eliminat/oricine altcineva poate vedea
// titlul/imaginea unui detaliu privat prin feed/profil/rail-uri. Testul de regresie existent
// (server/repos/project-visibility.test.ts) acoperă căile de AZI; asta prinde căile NOI, mecanic.

// Fișiere unde apare riscul (enumerarea din CLAUDE.md): listări/agregări peste `details`.
export const RISKY_FILES = ["detailsRepo.ts", "profileRepo.ts", "usersRepo.ts"];

// Sink: orice referință la tabela `details` (import direct din db/schema) în corpul funcției — Drizzle
// query builder (`.from(details)`, `.innerJoin(details, ...)`) sau `sql\`...${details}...\`` raw.
const SINK_RE = /\bdetails\b/;

// Gărzi cunoscute — oricare din ele, prezentă ORIUNDE în corpul funcției:
//  - `isNull(details.projectId)` (helper Drizzle, cel mai comun);
//  - `${details.projectId} is null` (SQL raw, folosit de usersRepo.listTopAuthors);
//  - `hasProjectAccessForUser(...)` (helper compus, include isNull intern — vezi detailsRepo.ts);
//  - `eq(details.projectId, ...)` (scopare explicită pe UN proiect — legitim pt funcții interne de
//    proiect, apelate DUPĂ ce apelantul a verificat membership la nivel de service, ex. listProjectDetails);
//  - `canAccessProjectDetail(...)` (gate de service apelat direct, cazuri rare).
const GUARD_RE =
  /isNull\(\s*details\.projectId\s*\)|details\.projectId\s*\}\s*is\s*(not\s+)?null|hasProjectAccessForUser|eq\(\s*details\.projectId\s*,|canAccessProjectDetail/i;

/** Extrage funcțiile top-level `(export )?(async )?function NAME(...) { ... }` dintr-un fișier sursă. */
export function findFunctions(source) {
  const functions = [];
  const fnRe = /\b(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
  let match;
  while ((match = fnRe.exec(source))) {
    const name = match[1];

    // Sări peste lista de parametri (poate conține propriile ei `{...}` — tipuri inline).
    let parenDepth = 1;
    let i = fnRe.lastIndex;
    for (; i < source.length && parenDepth > 0; i++) {
      if (source[i] === "(") parenDepth++;
      else if (source[i] === ")") parenDepth--;
    }

    // De la finalul parametrilor (posibil urmat de `: Promise<...>`), primul `{` e corpul.
    const braceStart = source.indexOf("{", i);
    if (braceStart === -1) continue;
    let depth = 0;
    let j = braceStart;
    for (; j < source.length; j++) {
      const ch = source[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = source.slice(braceStart, j + 1);
    const lineNumber = source.slice(0, match.index).split("\n").length;
    functions.push({ name, body, lineNumber });
    fnRe.lastIndex = j + 1;
  }
  return functions;
}

/** Găsește funcții care ating tabela `details` fără nicio gardă de scopare pe proiect în același corp. */
export function findViolations(source) {
  const violations = [];
  for (const { name, body, lineNumber } of findFunctions(source)) {
    if (!SINK_RE.test(body)) continue;
    if (GUARD_RE.test(body)) continue;
    violations.push({
      functionName: name,
      lineNumber,
      snippet: body.trim().slice(0, 140).replace(/\s+/g, " "),
    });
  }
  return violations;
}
