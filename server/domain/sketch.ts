// Domain Schiță — reguli pure pentru „foaia" desenată peste un detaliu-mamă (~fork).
// State machine (enforce în SketchService) — simplificat 2026-06-30 (decizie Edi):
//   DRAFT ──(autor PUBLISH)──▶ PUBLISHED (intră direct în teanc, public)
// Schițele se publică DIRECT (fără coadă de acceptare). Moderare POST-publicare: autorul detaliului-mamă
// (sau autorul schiței) poate ȘTERGE o schiță nerelevantă. Un singur autor pe foaie. Asincron, fără real-time.
// PENDING_ACCEPTANCE / REJECTED rămân în enum pentru date istorice, dar NU se mai produc.
// Stroke-uri stocate VECTORIAL, coordonate normalizate 0..1 față de imaginea-mamă.

export const SKETCH_STATUS = {
  DRAFT: "DRAFT",
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE", // moștenit (flux vechi) — nemaifolosit
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED", // moștenit (flux vechi) — nemaifolosit
} as const;
export type SketchStatus = (typeof SKETCH_STATUS)[keyof typeof SKETCH_STATUS];

// ── Adnotarea autorului (2026-07-31) ────────────────────────────────────────────────────────────
// O schiță făcută de AUTORUL detaliului pe PROPRIUL lui detaliu nu e un „fork/PR" (contribuția altcuiva) —
// e autorul care se explică singur pe imaginea lui. Structural e tot un rând în `sketches` (același desen,
// aceleași stroke-uri normalizate, același thumbnail), dar SEMANTIC e altceva → nu intră în teanc, nu se
// numără ca „schiță primită", nu apare ca tab separat cu avatarul autorului lângă el însuși. Se afișează
// ca adnotare peste imaginea de bază a detaliului.
//
// Predicat unic (mirror-uit în SQL acolo unde filtrarea se face în DB — vezi sketchesRepo/detailsRepo/
// profileRepo: `sketches.author_id = details.author_id`). Schimbi regula aici → schimbi și SQL-ul.
export function isSelfAnnotation(input: {
  sketchAuthorId: string;
  detailAuthorId: string;
}): boolean {
  return input.sketchAuthorId === input.detailAuthorId;
}

// Câte adnotări poate avea un detaliu (decizie Liviu 2026-08-02). Autorul poate explica mai multe lucruri
// separat, dar nu la nesfârșit: peste 3, selectorul devine nefolosibil și imaginea de bază dispare sub
// desene. Plafonul se impune pe SERVER (`publish`) — UI-ul doar dezactivează butonul, nu e sursă de adevăr.
// Istoric: 2026-07-31→2026-08-01 regula era „exact o adnotare, re-adnotarea o ÎNLOCUIEȘTE"; înlocuită aici
// cu „până la 3, fiecare distinctă, ștergere explicită din UI". Vezi CHANGELOG 2026-08-02.
export const MAX_ANNOTATIONS_PER_DETAIL = 3;

// Mai încape o adnotare pe acest detaliu? (`count` = adnotările PUBLISHED existente.)
export function canAddAnnotation(count: number): boolean {
  return count < MAX_ANNOTATIONS_PER_DETAIL;
}

// Notă a autorului — explicație în cuvinte pt schiță, SEPARATĂ de desen (2026-07-16, decizie Liviu după ce
// tool-ul de Text cu ancoră în margine a arătat prost în practică — un câmp dedicat e mai clar decât text
// liber plasat pe canvas). Opțională; goală → nu se afișează la citire.
export const MAX_SKETCH_NOTE_LENGTH = 500;
export type SketchNoteError = "TOO_LONG";
export function validateSketchNote(input: unknown): { ok: true; value: string | null } | { ok: false; error: SketchNoteError } {
  if (input == null) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "TOO_LONG" };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > MAX_SKETCH_NOTE_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value: trimmed };
}

// Paletă de schiță: culori stridente dar aliniate la brandul cald DETALIA (teracotă/ocru/cărămiziu),
// condusă de grafit (adnotare tehnică) — toate pop bine peste detaliul-mamă estompat. Single source: schimbă aici.
// Grosimile sunt px la o lățime de referință de 1000 (vezi REFERENCE_WIDTH în randare) — scalate la randare.
export const STROKE_COLORS = ["#211d18", "#b0463c", "#d97a1e", "#caa12e", "#2f8f5f", "#2f6fb0"] as const;
export const STROKE_WIDTHS = [8, 16, 28] as const;

// ── Bara continuă de culoare (2026-08-06, cerere Edi) ────────────────────────
// Înlocuiește grila de 6 culori fixe din editorul de schiță: o bară verticală (același model vizual
// ca sliderul de grosime) cu ALB sus, NEGRU jos și culorile de brand între ele.
//
// Opririle sunt exact culorile din `STROKE_COLORS`, plus alb și negru la capete — poziționate pe
// procente rotunde, ca sliderul (0..100, pas 1) să le poată atinge EXACT: altfel „bară continuă" ar
// fi însemnat că nu mai poți nimeri o culoare de brand.
//
// Serverul NU are nevoie de schimbări: `validateStrokes` acceptă de la început orice hex valid
// (HEX_COLOR_RE), nu doar lista fixă — verificat 2026-08-06, contrar ipotezei din planul inițial.
export const COLOR_RAMP_STOPS = [
  { at: 0, color: "#ffffff" },
  { at: 15, color: "#caa12e" },
  { at: 30, color: "#d97a1e" },
  { at: 45, color: "#b0463c" },
  { at: 60, color: "#2f8f5f" },
  { at: 75, color: "#2f6fb0" },
  { at: 90, color: "#211d18" },
  { at: 100, color: "#000000" },
] as const;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

// Culoarea de la poziția `pos` (0..100) pe bară — interpolare liniară în RGB între opririle vecine.
// Valorile în afara intervalului se clamp-uiesc la capete (un slider nu le produce, dar funcția e
// publică și nu presupune apelantul).
export function colorAtRampPosition(pos: number): string {
  if (!Number.isFinite(pos)) return COLOR_RAMP_STOPS[0].color;
  const p = Math.min(100, Math.max(0, pos));

  for (let i = 0; i < COLOR_RAMP_STOPS.length - 1; i++) {
    const a = COLOR_RAMP_STOPS[i];
    const b = COLOR_RAMP_STOPS[i + 1];
    if (p < a.at || p > b.at) continue;

    const span = b.at - a.at;
    const t = span === 0 ? 0 : (p - a.at) / span;
    const [ar, ag, ab] = hexToRgb(a.color);
    const [br, bg, bb] = hexToRgb(b.color);
    return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
  }

  return COLOR_RAMP_STOPS[COLOR_RAMP_STOPS.length - 1].color;
}

// Gradientul CSS al barei — derivat din ACELEAȘI opriri ca funcția de mai sus, ca ce vezi pe bară să
// fie exact ce obții la click (o listă duplicată în CSS ar fi divergat tăcut).
export function colorRampGradient(direction = "to bottom"): string {
  const stops = COLOR_RAMP_STOPS.map((s) => `${s.color} ${s.at}%`).join(", ");
  return `linear-gradient(${direction}, ${stops})`;
}

// Un punct = [x, y] normalizat 0..1 față de imaginea-mamă (rezoluție-agnostic).
export type Point = [number, number];
// Unealta cu care a fost desenat stroke-ul. Toate formele cu 2 capete (line/rect/ellipse/arrow) folosesc
// primul + ultimul punct. „free" = traseu freehand (perfect-freehand); „text" = casetă la `points[0]`
// (`size` = mărimea fontului). Opțional → stroke-urile vechi (fără `kind`) rămân „free" implicit.
type StrokeKind = "free" | "line" | "text" | "rect" | "ellipse" | "arrow";
const STROKE_KINDS: StrokeKind[] = ["free", "line", "text", "rect", "ellipse", "arrow"];
export const MAX_TEXT_LENGTH = 200;
export type Stroke = {
  color: string;
  size: number;
  points: Point[];
  kind?: StrokeKind;
  text?: string; // doar pt kind === "text"
  angle?: number; // rotație în radiani, doar pt kind === "text" (în jurul ancorei points[0])
};

// Limite anti-abuz pentru payload-ul vectorial (bound pe mărimea jsonb).
export const MAX_STROKES = 2000;
export const MAX_POINTS_PER_STROKE = 10000;
export const MAX_STROKE_SIZE = 100;
// Plafon agregat pe dimensiunea documentului serializat (bytes din JSON.stringify) — MAX_STROKES ×
// MAX_POINTS_PER_STROKE lasă teoretic sute de MB; fără acest cap, autosave-ul repetat (rate-limit-at,
// dar tot posibil) ar putea umple jsonb-ul din DB fără control agregat. Sub `bodySizeLimit` (4 MB,
// `next.config.ts`, partajat de toate server actions) cu marjă pt overhead de serializare — vezi
// MAX_STATE_BYTES din server/domain/plansa.ts (același raționament).
export const MAX_STROKES_BYTES = 3_000_000; // 3 MB

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export type StrokesValidationResult =
  | { ok: true; value: Stroke[] }
  | { ok: false; error: "TOO_MANY_STROKES" | "INVALID_STROKE" | "EMPTY" | "TOO_LARGE" };

function isNormalized(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

// Validează + normalizează structural lista de stroke-uri (server = sursa de adevăr).
export function validateStrokes(input: unknown): StrokesValidationResult {
  if (!Array.isArray(input)) return { ok: false, error: "INVALID_STROKE" };
  if (input.length === 0) return { ok: false, error: "EMPTY" };
  if (input.length > MAX_STROKES) return { ok: false, error: "TOO_MANY_STROKES" };

  const value: Stroke[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return { ok: false, error: "INVALID_STROKE" };
    const s = raw as Record<string, unknown>;

    if (typeof s.color !== "string" || !HEX_COLOR_RE.test(s.color)) {
      return { ok: false, error: "INVALID_STROKE" };
    }
    if (typeof s.size !== "number" || !(s.size > 0) || s.size > MAX_STROKE_SIZE) {
      return { ok: false, error: "INVALID_STROKE" };
    }
    if (!Array.isArray(s.points) || s.points.length === 0 || s.points.length > MAX_POINTS_PER_STROKE) {
      return { ok: false, error: "INVALID_STROKE" };
    }

    // `kind` opțional: dacă lipsește → „free"; dacă e prezent trebuie să fie una din uneltele cunoscute.
    let kind: StrokeKind = "free";
    if (s.kind !== undefined) {
      if (typeof s.kind !== "string" || !STROKE_KINDS.includes(s.kind as StrokeKind)) {
        return { ok: false, error: "INVALID_STROKE" };
      }
      kind = s.kind as StrokeKind;
    }

    // `text` obligatoriu (și doar) pentru kind === "text": șir nevid, lungime mărginită.
    let text: string | undefined;
    let angle: number | undefined;
    if (kind === "text") {
      if (typeof s.text !== "string") return { ok: false, error: "INVALID_STROKE" };
      const trimmed = s.text.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: "INVALID_STROKE" };
      }
      text = trimmed;
      // `angle` opțional (radiani). Acceptăm orice număr finit; îl normalizăm la [-2π, 2π].
      if (s.angle !== undefined) {
        if (typeof s.angle !== "number" || !Number.isFinite(s.angle)) {
          return { ok: false, error: "INVALID_STROKE" };
        }
        angle = s.angle % (Math.PI * 2);
      }
    }

    const points: Point[] = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2 || !isNormalized(p[0]) || !isNormalized(p[1])) {
        return { ok: false, error: "INVALID_STROKE" };
      }
      points.push([p[0], p[1]]);
    }
    value.push(
      kind === "text"
        ? { color: s.color, size: s.size, points, kind, text, ...(angle !== undefined ? { angle } : {}) }
        : { color: s.color, size: s.size, points, kind },
    );
  }

  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return { ok: false, error: "INVALID_STROKE" };
  }
  if (bytes > MAX_STROKES_BYTES) return { ok: false, error: "TOO_LARGE" };

  return { ok: true, value };
}

// Duplică blocul de text de la indexul dat: copie identică, deplasată puțin diagonal, ca să nu se
// suprapună perfect peste original. Ancora rămâne în [0,1] (coordonate normalizate) chiar dacă
// originalul e lipit de marginea din dreapta-jos.
//
// Întoarce `null` dacă duplicarea nu e posibilă: index invalid, stroke care nu e text, sau plafonul
// MAX_STROKES atins — UI-ul dezactivează butonul în acest ultim caz, dar plafonul se verifică ȘI aici
// (o singură sursă de adevăr, nu doar în componentă).
export const TEXT_DUPLICATE_OFFSET = 0.02;

export function duplicateTextStroke(
  strokes: Stroke[],
  index: number,
): { strokes: Stroke[]; newIndex: number } | null {
  if (!Number.isInteger(index) || index < 0 || index >= strokes.length) return null;
  if (strokes.length >= MAX_STROKES) return null;

  const source = strokes[index];
  if (source.kind !== "text") return null;

  const [x, y] = source.points[0] ?? [0, 0];
  const copy: Stroke = {
    ...source,
    points: [[Math.min(1, x + TEXT_DUPLICATE_OFFSET), Math.min(1, y + TEXT_DUPLICATE_OFFSET)]],
  };

  return { strokes: [...strokes, copy], newIndex: strokes.length };
}
