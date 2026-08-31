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
    if (!/\bselect\b/i.test(body) || !/\bfrom\s+\$\{\w+\}/i.test(body)) continue;

    // Verificarea e PE BRAȚ, nu pe tot template-ul: un `union all` are câte un scope propriu per braț.
    // Tabelele „proprii" ale unui braț = cele din `FROM ${x}` ȘI `JOIN ${x}` DIN ACEL braț (un tabel
    // adus prin join are coloane la fel de legitime). Fără split pe brațe, un ref la un tabel care
    // există doar în alt braț ar trece fals (finding Greptile #270).
    const branches = body.split(/\bunion(?:\s+all)?\b/i);
    for (const branch of branches) {
      const ownTables = new Set(
        [...branch.matchAll(/\b(?:from|join)\s+\$\{(\w+)\}/gi)].map((m) => m[1]),
      );
      if (ownTables.size === 0) continue; // braț fără FROM ${x} propriu → nu e subquery corelat
      const ownTable = [...ownTables].join(", ");

      const columnRefRe = /\$\{(\w+)\.(\w+)\}/g;
      let ref;
      while ((ref = columnRefRe.exec(branch))) {
        const [, table, column] = ref;
        if (ownTables.has(table)) continue;
        violations.push({
          lineNumber,
          ownTable,
          table,
          column,
          snippet: branch.trim().slice(0, 140).replace(/\s+/g, " "),
        });
      }
    }
  }
  return violations;
}
