// Domain Schiță — reguli pure pentru „foaia" desenată peste un detaliu-mamă (~fork+PR).
// State machine (enforce în SketchService):
//   DRAFT ──(autor SEND)──▶ PENDING_ACCEPTANCE
//                              ├── autor detaliu-mamă ACCEPTĂ ─▶ PUBLISHED (intră în teanc, public)
//                              └── autor detaliu-mamă RESPINGE ─▶ REJECTED
// Publică DOAR cu send (autor schiță) + accept (autor mamă). Un singur autor pe foaie. Asincron, fără real-time.
// Stroke-uri stocate VECTORIAL, coordonate normalizate 0..1 față de imaginea-mamă.

export const SKETCH_STATUS = {
  DRAFT: "DRAFT",
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
} as const;
export type SketchStatus = (typeof SKETCH_STATUS)[keyof typeof SKETCH_STATUS];

// Paletă recomandată pt UI: culori stridente + 3 grosimi (uneltele MVP). Folosite și ca default vizual.
// Grosimile sunt px la o lățime de referință de 1000 (vezi REFERENCE_WIDTH în randare) — scalate la randare.
export const STROKE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"] as const;
export const STROKE_WIDTHS = [8, 16, 28] as const;

// Un punct = [x, y] normalizat 0..1 față de imaginea-mamă (rezoluție-agnostic).
export type Point = [number, number];
export type Stroke = { color: string; size: number; points: Point[] };

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

    const points: Point[] = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2 || !isNormalized(p[0]) || !isNormalized(p[1])) {
        return { ok: false, error: "INVALID_STROKE" };
      }
      points.push([p[0], p[1]]);
    }
    value.push({ color: s.color, size: s.size, points });
  }
  return { ok: true, value };
}
