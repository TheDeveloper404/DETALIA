// Logica pură de detecție, separată de CLI (scripts/check-blob-write-guard.mjs) — testabilă direct
// (vezi scripts/blob-write-guard-check.test.ts) fără acces la disc. Mirror-uiește structura
// scripts/correlated-subquery-check.lib.mjs (aceeași filozofie de gardă mecanică pe un bug recurent).

// SEC-N01 (audit securitate 2026-08-20, fix aplicat în server/services/detailService.ts): o resursă cu
// URL din store-ul nostru de Blob dar al altui user permitea ștergere cross-user de fișiere. Fix-ul
// concret a fost local (hasForeignBlobResource pe 5 puncte de intrare) — asta e garda mecanică ce
// previne recidiva pe orice ALT write-path viitor care persistă un URL de Blob.
//
// Regulă: orice funcție din server/services/*.ts care apelează una din funcțiile-sink de mai jos
// (persistă un URL/o listă de resurse primite direct sau indirect de la client) trebuie să conțină, în
// ACEEAȘI funcție, un apel la una din funcțiile-gardă (care verifică ownership-ul URL-ului înainte).

// Sink-uri cunoscute: repo-uri care scriu în DB un câmp de tip URL de Blob venit (direct sau după
// re-procesare) dintr-un input de client. Extinde lista dacă apare un flux nou de acest tip.
const SINK_NAMES = [
  "insertDetailWithRelations",
  "updateDetailRow",
  "replaceDetailResources",
  "replaceMaterialOfferFiles", // SEC-N02 (2026-09-01): persistă lista de fișiere a ofertei (URL-uri de
  // la client) — exact aceeași categorie ca replaceDetailResources; lipsea, iar garda mecanică nu a
  // prins recidiva SEC-N01 în „Oferă materiale".
  "insertComment",
  "updateUserImage",
  "updateUserCoverImage",
];

// Gărzi cunoscute: toate verifică (direct sau intern) `isUsersBlobUrl` înainte de a lăsa URL-ul să
// ajungă la un sink. `reprocessBlobImage` (lib/image-processing.ts) o face INTERN — un apelant care
// trece prin ea e la fel de acoperit ca unul care apelează `isUsersBlobUrl` direct.
const GUARD_NAMES = ["isUsersBlobUrl", "hasForeignBlobResource", "reprocessBlobImage"];

const SINK_RE = new RegExp(`\\b(${SINK_NAMES.join("|")})\\s*\\(`);
const GUARD_RE = new RegExp(`\\b(${GUARD_NAMES.join("|")})\\s*\\(`);

/** Extrage funcțiile top-level `(export )?async function NAME(...) { ... }` dintr-un fișier sursă. */
export function findFunctions(source) {
  const functions = [];
  const fnRe = /\b(?:export\s+)?async function\s+(\w+)\s*\(/g;
  let match;
  while ((match = fnRe.exec(source))) {
    const name = match[1];

    // Sări peste lista de parametri (poate conține propriile ei `{...}` — tipuri inline, ex.
    // `input: { authorId: string }` — primul `{` din text NU e neapărat corpul funcției).
    let parenDepth = 1;
    let i = fnRe.lastIndex; // poziția imediat după `(` cu care s-a terminat match-ul
    for (; i < source.length && parenDepth > 0; i++) {
      if (source[i] === "(") parenDepth++;
      else if (source[i] === ")") parenDepth--;
    }

    // De la finalul parametrilor (posibil urmat de `: Promise<...>`), primul `{` e chiar corpul.
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

/** Găsește funcții care ating un sink de scriere Blob fără nicio gardă de ownership în același corp. */
export function findViolations(source) {
  const violations = [];
  for (const { name, body, lineNumber } of findFunctions(source)) {
    const sinkMatch = body.match(SINK_RE);
    if (!sinkMatch) continue;
    if (GUARD_RE.test(body)) continue;
    violations.push({
      functionName: name,
      lineNumber,
      sink: sinkMatch[1],
      snippet: body.trim().slice(0, 140).replace(/\s+/g, " "),
    });
  }
  return violations;
}
