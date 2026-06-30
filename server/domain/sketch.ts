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

// Paletă de schiță: culori stridente dar aliniate la brandul cald DETALIA (teracotă/ocru/cărămiziu),
// condusă de grafit (adnotare tehnică) — toate pop bine peste detaliul-mamă estompat. Single source: schimbă aici.
// Grosimile sunt px la o lățime de referință de 1000 (vezi REFERENCE_WIDTH în randare) — scalate la randare.
export const STROKE_COLORS = ["#211d18", "#b0463c", "#d97a1e", "#caa12e", "#2f8f5f", "#2f6fb0"] as const;
export const STROKE_WIDTHS = [8, 16, 28] as const;

// Un punct = [x, y] normalizat 0..1 față de imaginea-mamă (rezoluție-agnostic).
export type Point = [number, number];
// Unealta cu care a fost desenat stroke-ul. Toate formele cu 2 capete (line/rect/ellipse/arrow) folosesc
// primul + ultimul punct. „free" = traseu freehand (perfect-freehand); „text" = casetă la `points[0]`
// (`size` = mărimea fontului). Opțional → stroke-urile vechi (fără `kind`) rămân „free" implicit.
export type StrokeKind = "free" | "line" | "text" | "rect" | "ellipse" | "arrow";
export const STROKE_KINDS: StrokeKind[] = ["free", "line", "text", "rect", "ellipse", "arrow"];
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

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export type StrokesValidationResult =
  | { ok: true; value: Stroke[] }
  | { ok: false; error: "TOO_MANY_STROKES" | "INVALID_STROKE" | "EMPTY" };

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
  return { ok: true, value };
}
