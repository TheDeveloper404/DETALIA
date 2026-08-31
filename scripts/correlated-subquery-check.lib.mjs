// Logica pură de detecție, separată de CLI (scripts/check-correlated-subqueries.mjs) ca să fie
// testabilă direct (vezi scripts/correlated-subquery-check.test.ts) fără acces la disc.

/** Extrage span-urile de template literal `sql`...`` (inclusiv `sql<Tip>`...``) dintr-un fișier. */
export function findSqlTemplates(source) {
  const templates = [];
  const tagRe = /\bsql(?:<[^>]*>)?`/g;
  let match;
  while ((match = tagRe.exec(source))) {
    const start = match.index + match[0].length;
    let depth = 0;
    let i = start;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`" && depth === 0) break;
      if (ch === "$" && source[i + 1] === "{") depth++;
      if (ch === "}" && depth > 0) depth--;
    }
    const body = source.slice(start, i);
    const lineNumber = source.slice(0, match.index).split("\n").length;
    templates.push({ body, lineNumber });
    tagRe.lastIndex = i + 1;
  }
  return templates;
}

/** Găsește interpolări `${tabel.coloană}` necalificate într-un subquery corelat, dintr-un string sursă. */
export function findViolations(source) {
  const violations = [];

  for (const { body, lineNumber } of findSqlTemplates(source)) {
    // Tabele „proprii" ale template-ului = toate cele din `FROM ${x}` ȘI `JOIN ${x}`, pe toate brațele
    // unui `union all`. Nu doar primul `FROM`: fiecare braț își referă legitim propriul tabel, iar un
    // tabel adus prin `join` are coloane la fel de legitime (altfel `comments.*`/`sketches.*` din
    // brațele 2-3, sau `users.*` de după un `join ${users}`, ar fi marcate fals — vezi `interactorRows`
    // / `interactorAvatars` din detailsRepo.ts).
    const ownTables = new Set(
      [...body.matchAll(/\b(?:from|join)\s+\$\{(\w+)\}/gi)].map((m) => m[1]),
    );
    const isCorrelatedSubquery = /\bselect\b/i.test(body) && /\bfrom\s+\$\{\w+\}/i.test(body);
    if (!isCorrelatedSubquery) continue;

    const ownTable = [...ownTables].join(", ");
    const columnRefRe = /\$\{(\w+)\.(\w+)\}/g;
    let ref;
    while ((ref = columnRefRe.exec(body))) {
      const [, table, column] = ref;
      if (!ownTables.has(table)) {
        violations.push({
          lineNumber,
          ownTable,
          table,
          column,
          snippet: body.trim().slice(0, 140).replace(/\s+/g, " "),
        });
      }
    }
  }
  return violations;
}
