// Mențiuni @schiță în corpul comentariilor (fără schimbare de schemă — token inline în text).
//
// Format token:  @[Nume Autor](sid:<uuid>)
//   - `Nume Autor` = eticheta afișată (fără `]`, curățată la inserare).
//   - `<uuid>` = id-ul schiței referite (validat pe SERVER că aparține detaliului — anti-IDOR).
//
// Corpul rămâne TEXT simplu peste tot; randarea mențiunilor se face printr-un parser propriu
// (fără dangerouslySetInnerHTML) → zero suprafață de injecție. Pe server, tokenii cu id-uri
// străine se degradează la text (numele), nu se randează ca link.

// UUID v4 canonic (același format ca `gen_random_uuid()` din Postgres).
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
// Eticheta: 1..80 caractere, fără `]` (ca să nu spargă parsarea). `g` pentru iterare.
const MENTION_RE = new RegExp(`@\\[([^\\]]{1,80})\\]\\(sid:(${UUID})\\)`, "g");

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; sketchId: string };

// Construiește un token de mențiune dintr-un nume + id de schiță (folosit de compozitor).
// Curăță caracterele care ar sparge formatul (`]`, paranteze, newline) din etichetă.
export function buildMentionToken(name: string, sketchId: string): string {
  const label = (name || "Anonim").replace(/[\]()\r\n]/g, " ").trim().slice(0, 80) || "Anonim";
  return `@[${label}](sid:${sketchId})`;
}

// Sparge corpul în segmente text/mențiune pentru randare. Nu validează id-urile (o face render-ul,
// care știe ce schițe există acum → degradare grațioasă pentru schițe șterse).
export function parseMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(body); m !== null; m = MENTION_RE.exec(body)) {
    if (m.index > last) segments.push({ type: "text", value: body.slice(last, m.index) });
    segments.push({ type: "mention", name: m[1], sketchId: m[2] });
    last = m.index + m[0].length;
  }
  if (last < body.length) segments.push({ type: "text", value: body.slice(last) });
  return segments;
}

// Găsește tokenul de mențiune care se termină EXACT la poziția caretului (folosit la Backspace, ca
// să ștergem tot tokenul dintr-o apăsare — altfel userul trebuie să șteargă caracter cu caracter
// prin `@[Nume](sid:uuid)`, ~50 de caractere).
export function mentionTokenEndingAt(text: string, caret: number): { start: number; end: number } | null {
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(text); m !== null; m = MENTION_RE.exec(text)) {
    const end = m.index + m[0].length;
    if (end === caret) return { start: m.index, end };
    if (end > caret) break;
  }
  return null;
}

// Reconstruiește corpul cu tokeni din textul AFIȘAT: fiecare `@Etichetă` cunoscută devine tokenul ei.
// Înlocuire cu GRANIȚĂ de cuvânt (nu substring naiv): `@Ana` NU se potrivește în `@Anatol` — altfel
// corpul salvat iese corupt (`@[Ana](sid:...)tol`). Etichetele lungi primele („Nume — schița 2"
// înaintea lui „Nume"); tokenii deja formați nu pot fi re-loviți (încep cu `@[`, nu cu `@Litera`).
export function replaceLabelsWithTokens(display: string, labels: Map<string, string>): string {
  let out = display;
  const entries = [...labels.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [label, sid] of entries) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`@${esc}(?![\\p{L}\\p{N}_])`, "gu"),
      () => buildMentionToken(label, sid),
    );
  }
  return out;
}

// Inversul: corpul STOCAT (cu tokeni) → text lizibil pentru editare (`@Etichetă`) + maparea
// etichetă→sid, ca la salvare corpul să se reconstruiască prin `replaceLabelsWithTokens`.
export function mentionsToDisplay(body: string): { display: string; labels: Map<string, string> } {
  const labels = new Map<string, string>();
  const display = parseMentions(body)
    .map((seg) => {
      if (seg.type === "text") return seg.value;
      labels.set(seg.name, seg.sketchId);
      return `@${seg.name}`;
    })
    .join("");
  return { display, labels };
}

// Id-urile de schiță referite în corp (pentru validarea pe server).
export function extractMentionSketchIds(body: string): string[] {
  const ids = new Set<string>();
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(body); m !== null; m = MENTION_RE.exec(body)) {
    ids.add(m[2]);
  }
  return [...ids];
}

// Degradează la text (numele) tokenii care NU trimit către un id valid; îi păstrează pe cei valizi.
// `validIds` = schițele care aparțin detaliului-țintă (verificate în DB). Corpul rezultat se stochează.
export function sanitizeMentions(body: string, validIds: Set<string>): string {
  MENTION_RE.lastIndex = 0;
  return body.replace(MENTION_RE, (full, name: string, sid: string) =>
    validIds.has(sid) ? full : name,
  );
}
