// Domain Schiță — reguli pure pentru „foaia" desenată peste un detaliu-mamă (~fork).
// State machine (enforce în SketchService) — simplificat 2026-06-30:
//   DRAFT ──(autor PUBLISH)──▶ PUBLISHED (intră direct în teanc, public)
// Schițele se publică DIRECT (fără coadă de acceptare). Moderare POST-publicare: autorul detaliului-mamă
// (sau autorul schiței) poate ȘTERGE o schiță nerelevantă. Un singur autor pe foaie. Asincron, fără real-time.
// PENDING_ACCEPTANCE / REJECTED rămân în enum pentru date istorice, dar NU se mai produc.
// Stroke-uri stocate VECTORIAL, coordonate normalizate 0..1 față de imaginea-mamă.

import { isUuid } from "@/server/domain/ids";

export const SKETCH_STATUS = {
  DRAFT: "DRAFT",
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE", // moștenit (flux vechi) — nemaifolosit
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED", // moștenit (flux vechi) — nemaifolosit
} as const;
export type SketchStatus = (typeof SKETCH_STATUS)[keyof typeof SKETCH_STATUS];

// ── Adnotarea autorului (2026-07-31, redefinită 2026-08-11) ────────────────────────────────────
// O schiță făcută de AUTORUL detaliului pe PROPRIUL lui detaliu, DAR DOAR cea creată explicit prin
// `createAnnotation()` (din formularul de Adaugă/Editează detaliu) e o „adnotare" — explicația
// autorului pe propria imagine, parte din datele detaliului (ca titlu/descriere), nu o contribuție
// primită. Identitatea ei e coloana `sketches.isAnnotation`, NU mai e derivată din egalitatea de autor:
// până la 2026-08-11, ORICE desen al autorului pe propriul detaliu (inclusiv unul făcut mai târziu,
// prin „Schițează peste" normal, în plină dezbatere) era tratat ca adnotare — bug real: îngropa
// desenele ulterioare ale autorului sub un plafon greșit și le excludea din teanc/stack.
// ACUM: doar rândul cu `isAnnotation = true` e adnotare; orice alt desen al autorului pe propriul
// detaliu, făcut prin fluxul normal de schițat, e o schiță obișnuită — intră în teanc, se numără, poate
// fi bază de stack pentru alții.
export const MAX_ANNOTATIONS_PER_DETAIL = 1;

// Adnotarea poate fi folosită ca fundal pentru schițele altora (2026-08-11, decizie de produs: e
// „startul dezbaterii", cititorii trebuie să poată construi peste ea) — spre deosebire de perioada
// 07-31→08-11, când era exclusă explicit din `filterPublishedSketchIds`.

// Predicat de identitate: „acest actor e AUTORUL detaliului?" — folosit la (1) authz-ul creării/editării
// adnotării (doar autorul detaliului poate face una), și (2) suprimarea notificării „nu te anunț pe tine
// pentru propriul desen". NU mai decide ce rând E adnotare — aia stă în `isAnnotation` (coloană DB),
// tocmai ca să nu mai confunde „e autorul" cu „e desenul de la publicare".
export function isSelfAnnotation(input: {
  sketchAuthorId: string;
  detailAuthorId: string;
}): boolean {
  return input.sketchAuthorId === input.detailAuthorId;
}

// Mai încape o adnotare pe acest detaliu? (`count` = adnotările PUBLISHED existente.)
export function canAddAnnotation(count: number): boolean {
  return count < MAX_ANNOTATIONS_PER_DETAIL;
}

// ── Stack de foi (2026-08-08) ───────────────────────────────────────────────────────────────────
// „Schițează peste" îngheață EXACT ce e aprins pe ecran în momentul apăsării și folosește asta ca
// fundal al foii noi. `baseSketchIds` = rețeta acelui fundal: lista ORDONATĂ (de jos în sus) a
// schițelor care erau aprinse. Goală → s-a pornit de pe detaliul gol (comportamentul de dinainte,
// și starea tuturor schițelor existente la migrare).
//
// Lista nu se rezolvă recursiv: la capturare e deja aplatizată — ce vedea userul ATUNCI era deja
// „bază + tot ce era aprins", oricât de adânc era stack-ul lor. ATENȚIE, ce se îngheață aici e ORDINEA
// și COMPONENȚA, nu conținutul: stroke-urile fiecărei foi se citesc după id la randare.
//
// De-aceea o foaie folosită ca fundal nu mai poate fi ștearsă complet: `lockedAt` se setează la
// publicarea schiței de deasupra, iar `deleteSketch` îl citește și degradează ștergerea la una
// parțială (vezi `resolveSketchDeletionMode` mai jos). Altfel desenul construit peste ea ar rămâne
// suspendat peste un gol, tăcut — randarea sare pur și simplu foaia lipsă.
export const MAX_STACK_DEPTH = 20;

export type BaseSketchIdsError = "INVALID_STACK" | "STACK_TOO_DEEP";

// Validează structural lista de id-uri de fundal: array de UUID-uri, deduplicat (păstrând prima
// apariție, deci ordinea de desenare), sub plafon. NU verifică apartenența la detaliu sau statusul
// schițelor — alea cer DB și se fac în service (`createDraft`).
export function validateBaseSketchIds(
  input: unknown,
): { ok: true; value: string[] } | { ok: false; error: BaseSketchIdsError } {
  if (input == null) return { ok: true, value: [] };
  if (!Array.isArray(input)) return { ok: false, error: "INVALID_STACK" };

  const seen = new Set<string>();
  const value: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string" || !isUuid(raw)) return { ok: false, error: "INVALID_STACK" };
    if (seen.has(raw)) continue;
    seen.add(raw);
    value.push(raw);
    // Ieșire din buclă la depășire, nu după parcurgerea întregului array: cu `bodySizeLimit` de 4 MB
    // un client poate trimite ~110k id-uri unice, iar respingerea abia la final ar însemna să le
    // parcurgem și să ținem un Set de 110k intrări degeaba.
    if (value.length > MAX_STACK_DEPTH) return { ok: false, error: "STACK_TOO_DEEP" };
  }
  // Plafonul se aplică DUPĂ deduplicare: un payload cu același id repetat de 100 de ori e o listă de 1.
  return { ok: true, value };
}

// Compune stroke-urile de randat dintr-un stack: concatenare în ordinea dată (prima foaie = cea mai
// de jos, ultima = deasupra tuturor). Motorul de randare (`renderStrokes`) nu știe și nu-i pasă din ce
// foaie vine un stroke — de-aia un stack e doar o listă mai lungă, nu un mecanism nou de desenare.
// Foile stinse din bife pur și simplu nu se dau aici.
//
// STRICT PENTRU RANDARE — rezultatul NU se salvează și NU trece prin `validateStrokes`: un stack plin
// poate ajunge la MAX_STACK_DEPTH × MAX_STROKES (20 × 2000 = 40.000 stroke-uri), de ~20× peste plafonul
// per-foaie și peste MAX_STROKES_BYTES odată serializat. Fiecare foaie rămâne validată individual, la
// scrierea ei; compunerea e o vedere efemeră, nu un document nou.
export function composeStackStrokes(layers: Array<{ strokes: Stroke[] | null }>): Stroke[] {
  const out: Stroke[] = [];
  for (const layer of layers) {
    if (layer.strokes) out.push(...layer.strokes);
  }
  return out;
}

// Rezolvă rețeta unui stack (baseSketchIds) în foile ei reale, în ordinea din rețetă, sărind id-urile
// dispărute (foaie ștearsă între timp). O foaie de fundal poate fi o schiță din teanc SAU adnotarea
// autorului (ambele valide ca bază, vezi mai sus) — cele două trăiesc în surse separate (teanc vs
// adnotări), deci rezolvarea trebuie să caute în AMBELE. BUG găsit 2026-08-18: căutarea se făcea doar
// în teanc, așa că un stack construit peste adnotare o desena corect în editor (`getDraftForEdit`, care
// citește direct din DB) dar o pierdea tăcut la vizualizarea schiței deja publicate, dintr-un tab.
export function resolveStackLayers<TSketch, TAnnotation>(
  baseSketchIds: string[],
  sketchById: Map<string, TSketch>,
  annotationById: Map<string, TAnnotation>,
): Array<{ id: string; source: "sketch"; layer: TSketch } | { id: string; source: "annotation"; layer: TAnnotation }> {
  const out: Array<
    { id: string; source: "sketch"; layer: TSketch } | { id: string; source: "annotation"; layer: TAnnotation }
  > = [];
  for (const id of baseSketchIds) {
    const sketch = sketchById.get(id);
    if (sketch) {
      out.push({ id, source: "sketch", layer: sketch });
      continue;
    }
    const annotation = annotationById.get(id);
    if (annotation) {
      out.push({ id, source: "annotation", layer: annotation });
    }
  }
  return out;
}

// ── Ștergerea unei foi din stack (2026-08-08, Faza B) ───────────────────────────────────────────
// O foaie pe care ALTCINEVA a construit (`lockedAt` setat la publicarea schiței de deasupra) nu mai
// poate dispărea complet — desenul de deasupra ar rămâne suspendat peste un gol. Ce se poate retrage
// e IDENTITATEA autorului, nu contribuția: rămâne „Autor șters · rol", desenul rămâne pe masă.
//
// Regula se aplică TUTUROR, inclusiv autorului detaliului (decizie de produs 2026-08-08) — dar
// moderatorul nici nu primește ștergerea parțială în loc: a retrage numele altcuiva nu e moderare,
// e o pedeapsă. El primește refuz, iar retragerea identității rămâne strict a autorului.
export type SketchDeletionMode =
  | "HARD" // dispare complet (nimeni n-a construit peste ea)
  | "PARTIAL" // rămâne desenul, dispare identitatea autorului
  | "FORBIDDEN"; // foaie blocată, iar actorul nu e autorul ei

export function resolveSketchDeletionMode(input: {
  lockedAt: Date | null;
  isSketchAuthor: boolean;
  isDetailAuthor: boolean;
}): SketchDeletionMode {
  if (!input.isSketchAuthor && !input.isDetailAuthor) return "FORBIDDEN";
  // Nimeni n-a construit peste ea → comportamentul dinainte, pentru ambii.
  // `== null` intenționat (nu `===`): prinde și `undefined`, care apare când rândul vine dintr-un
  // select parțial fără coloana asta. Un `undefined` tratat ca „blocat" ar refuza tăcut ștergeri
  // perfect legitime — mai bine strict pe prezența unei date reale.
  if (input.lockedAt == null) return "HARD";
  // Blocată: doar autorul ei poate retrage ce e al lui — numele.
  return input.isSketchAuthor ? "PARTIAL" : "FORBIDDEN";
}

// Numele afișabil al autorului unei foi din care identitatea a fost retrasă. Rolul vine din snapshot-ul
// înghețat LA PUBLICARE (`roleSnapshot`), nu din rolul curent — userul poate să-l fi schimbat între timp,
// iar ce contează istoric e cine era când a desenat.
export const REMOVED_AUTHOR_LABEL = "Autor șters";

// Notă a autorului — explicație în cuvinte pt schiță, SEPARATĂ de desen (2026-07-16, decizie luată după ce
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

// ── Bara continuă de culoare (2026-08-06) ────────────────────────
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

// ── Spațiul de coordonate al foii (2026-08-31) ─────────────────────────────────────────────────
// Un punct = [x, y] normalizat față de imaginea-mamă (rezoluție-agnostic). Dreptunghiul imaginii e
// [0,0]–[1,1]; în jurul lui există o BANDĂ de lucru („pasteboard") de `PASTEBOARD_MARGIN` pe fiecare
// latură, în care userul poate trage săgeți / scrie text ca să nu înghesuie desenul pe foaie.
// Intervalul valid devine deci [-PASTEBOARD_MARGIN, 1 + PASTEBOARD_MARGIN] pe ambele axe.
// Schițele de dinainte au toate punctele în [0,1] → rămân valide fără migrare.
// Împărtășit cu editorul de Planșă (`server/domain/plansa.ts` refoloseste `validateStrokes`).
export const PASTEBOARD_MARGIN = 0.15;
export const COORD_MIN = -PASTEBOARD_MARGIN;
export const COORD_MAX = 1 + PASTEBOARD_MARGIN;
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

// Coordonată validă pe foaie: număr finit în intervalul [lo, hi].
function isCanvasCoord(n: unknown, lo: number, hi: number): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
}

// Validează + normalizează structural lista de stroke-uri (server = sursa de adevăr).
// `coordMargin` = cât pot ieși coordonatele din dreptunghiul imaginii [0,1] (banda de „pasteboard").
// Implicit `PASTEBOARD_MARGIN` (editorul de schiță). Editorul de Planșă cere `0` — acolo nu există
// zonă de lucru în jur, iar `renderStrokes` e apelat fără `margin`, deci coordonate în afara [0,1]
// s-ar randa tăiate.
export function validateStrokes(
  input: unknown,
  coordMargin: number = PASTEBOARD_MARGIN,
): StrokesValidationResult {
  const lo = -coordMargin;
  const hi = 1 + coordMargin;
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
      if (!Array.isArray(p) || p.length !== 2 || !isCanvasCoord(p[0], lo, hi) || !isCanvasCoord(p[1], lo, hi)) {
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

// Clamp în banda foii (imagine + pasteboard). Folosit la duplicare ca ancora copiei să nu iasă din
// intervalul valid când originalul e lipit de colțul din dreapta-jos al benzii.
export function clampCanvasCoord(n: number): number {
  return Math.min(COORD_MAX, Math.max(COORD_MIN, n));
}

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
    points: [
      [clampCanvasCoord(x + TEXT_DUPLICATE_OFFSET), clampCanvasCoord(y + TEXT_DUPLICATE_OFFSET)],
    ],
  };

  return { strokes: [...strokes, copy], newIndex: strokes.length };
}
