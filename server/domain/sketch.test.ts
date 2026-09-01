import { describe, expect, it } from "vitest";

import {
  canAddAnnotation,
  MAX_ANNOTATIONS_PER_DETAIL,
  MAX_POINTS_PER_STROKE,
  MAX_SKETCH_NOTE_LENGTH,
  MAX_STACK_DEPTH,
  MAX_STROKES,
  MAX_STROKES_BYTES,
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
  colorAtRampPosition,
  computeExtent,
  isUnitExtent,
  INK_MARGIN,
  UNIT_EXTENT,
  DRAWABLE_MIN,
  DRAWABLE_MAX,
  composeStackStrokes,
  STROKE_COLORS,
  colorRampGradient,
  COLOR_RAMP_STOPS,
  duplicateTextStroke,
  isSelfAnnotation,
  resolveSketchDeletionMode,
  resolveStackLayers,
  TEXT_DUPLICATE_OFFSET,
  type Point,
  type Stroke,
  validateBaseSketchIds,
  validateSketchNote,
  validateStrokes,
} from "./sketch";

// Helper local: un stroke minim valid, cu culoare distinctă ca să pot urmări ORDINEA la compunere.
function strokeOf(color: string): Stroke {
  return { color, size: 8, points: [[0.1, 0.1], [0.2, 0.2]], kind: "free" };
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

// Predicat de identitate: „acest actor e AUTORUL detaliului?" — folosit la authz-ul adnotării și la
// suprimarea notificării „nu te anunț pe tine". NU mai decide ce rând E adnotare (2026-08-11) — aia
// stă în `sketches.isAnnotation`, coloană DB, nu identitate.
describe("isSelfAnnotation", () => {
  it("autorul schiței == autorul detaliului", () => {
    expect(isSelfAnnotation({ sketchAuthorId: "u1", detailAuthorId: "u1" })).toBe(true);
  });

  it("autori diferiți", () => {
    expect(isSelfAnnotation({ sketchAuthorId: "u2", detailAuthorId: "u1" })).toBe(false);
  });
});

// Plafonul de adnotări (2026-08-11: MAX_ANNOTATIONS_PER_DETAIL = 1, coborât de la 3) — verificat pe
// `isAnnotation`, nu pe identitatea autorului.
describe("canAddAnnotation", () => {
  it("MAX_ANNOTATIONS_PER_DETAIL e 1", () => {
    expect(MAX_ANNOTATIONS_PER_DETAIL).toBe(1);
  });

  it("0 adnotări existente → mai încape una", () => {
    expect(canAddAnnotation(0)).toBe(true);
  });

  it("la plafon → nu mai încape", () => {
    expect(canAddAnnotation(MAX_ANNOTATIONS_PER_DETAIL)).toBe(false);
  });
});

// Un stroke „free" valid minim, refolosit ca bază în teste.
function freeStroke(over: Record<string, unknown> = {}) {
  return { color: "#211d18", size: 8, points: [[0.1, 0.2]], kind: "free", ...over };
}

describe("validateStrokes — server e sursa de adevăr pentru payload-ul vectorial", () => {
  it("respinge ce nu e array", () => {
    expect(validateStrokes(null).ok).toBe(false);
    expect(validateStrokes("[]" as unknown).ok).toBe(false);
    expect(validateStrokes({} as unknown).ok).toBe(false);
  });

  it("respinge lista goală cu EMPTY (schiță fără conținut nu se trimite)", () => {
    const r = validateStrokes([]);
    expect(r).toEqual({ ok: false, error: "EMPTY" });
  });

  it("respinge peste MAX_STROKES (anti-abuz jsonb)", () => {
    const many = Array.from({ length: MAX_STROKES + 1 }, () => freeStroke());
    expect(validateStrokes(many)).toEqual({ ok: false, error: "TOO_MANY_STROKES" });
  });

  it("respinge documentul peste MAX_STROKES_BYTES chiar sub MAX_STROKES/MAX_POINTS_PER_STROKE", () => {
    // Puține stroke-uri (sub MAX_STROKES), fiecare cu MAX_POINTS_PER_STROKE puncte cu zecimale lungi
    // (evită rotunjirea la valori scurte) — payload agregat mare, dar fiecare limită individuală respectată.
    const heavyStroke = () =>
      freeStroke({
        points: Array.from({ length: MAX_POINTS_PER_STROKE }, (_, i) => [
          (i % 3) / 3,
          ((i + 1) % 3) / 3,
        ]),
      });
    const heavy = Array.from({ length: 20 }, heavyStroke);
    expect(heavy.length).toBeLessThan(MAX_STROKES);
    const r = validateStrokes(heavy);
    expect(r).toEqual({ ok: false, error: "TOO_LARGE" });
    // sanity-check pe premisă: payload-ul construit chiar depășește plafonul testat.
    expect(new TextEncoder().encode(JSON.stringify(heavy)).length).toBeGreaterThan(MAX_STROKES_BYTES);
  });

  it("respinge culoarea ne-hex (input controlat de client)", () => {
    expect(validateStrokes([freeStroke({ color: "red" })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ color: "#zzzzzz" })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ color: 123 })]).ok).toBe(false);
  });

  it("respinge size invalid (≤0 sau peste plafon)", () => {
    expect(validateStrokes([freeStroke({ size: 0 })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ size: -5 })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ size: MAX_STROKE_SIZE + 1 })]).ok).toBe(false);
  });

  it("puncte în banda pasteboard [-1, 2] sunt acceptate; în afara ei, respinse", () => {
    // Pasteboard 2026-09-01: intervalul permis s-a lărgit de la [0,1] la [-1,2] (o imagine-lățime
    // de fiecare latură). Ce intră în bandă e valid; ce trece de plafon e respins.
    expect(validateStrokes([freeStroke({ points: [[-0.4, 1.6]] })]).ok).toBe(true);
    expect(validateStrokes([freeStroke({ points: [[-1, 2]] })]).ok).toBe(true); // exact pe margine
    expect(validateStrokes([freeStroke({ points: [[2.01, 0.2]] })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ points: [[-1.01, 0.2]] })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ points: [[0.2]] })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ points: [["a", "b"]] })]).ok).toBe(false);
  });

  it("respinge prea multe puncte într-un stroke", () => {
    const pts = Array.from({ length: MAX_POINTS_PER_STROKE + 1 }, () => [0.5, 0.5]);
    expect(validateStrokes([freeStroke({ points: pts })]).ok).toBe(false);
  });

  it("respinge kind necunoscut", () => {
    expect(validateStrokes([freeStroke({ kind: "laser" })]).ok).toBe(false);
  });

  it("kind text: cere text nevid, ≤ MAX_TEXT_LENGTH", () => {
    const base = { color: "#211d18", size: 8, points: [[0.1, 0.2]], kind: "text" };
    expect(validateStrokes([{ ...base }]).ok).toBe(false); // fără text
    expect(validateStrokes([{ ...base, text: "   " }]).ok).toBe(false); // doar spații
    expect(validateStrokes([{ ...base, text: "x".repeat(MAX_TEXT_LENGTH + 1) }]).ok).toBe(false);
    const ok = validateStrokes([{ ...base, text: "  notă  " }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value[0].text).toBe("notă"); // trimmed
  });

  it("acceptă o listă validă și implicit kind=free când lipsește", () => {
    const r = validateStrokes([{ color: "#b0463c", size: 16, points: [[0, 0], [1, 1]] }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0].kind).toBe("free");
  });
});

// Pasteboard (2026-09-01): extent-ul unei schițe = cel mai mic dreptunghi care conține imaginea-mamă
// ([0,1]×[0,1], mereu) + toate punctele. E transformul unic pt editor/viewer/thumbnail.
describe("computeExtent — bounding box imagine + desen în afară", () => {
  const s = (points: Point[]): Stroke => ({ color: "#211d18", size: 8, points, kind: "free" });

  it("fără stroke-uri → doar imaginea (UNIT_EXTENT)", () => {
    expect(computeExtent([])).toEqual(UNIT_EXTENT);
    expect(isUnitExtent(computeExtent([]))).toBe(true);
  });

  it("stroke-uri strict peste imagine → tot UNIT_EXTENT (compatibil înapoi, schițele vechi neatinse)", () => {
    const e = computeExtent([s([[0, 0], [1, 1]]), s([[0.3, 0.9]])]);
    expect(e).toEqual(UNIT_EXTENT);
    expect(isUnitExtent(e)).toBe(true);
  });

  it("desen care iese în stânga-sus → extent = bbox + INK_MARGIN pe laturile ieșite, restul 0/1", () => {
    const e = computeExtent([s([[-0.3, -0.2], [0.5, 0.5]])]);
    expect(e).toEqual({ minX: -0.3 - INK_MARGIN, minY: -0.2 - INK_MARGIN, maxX: 1, maxY: 1 });
    expect(isUnitExtent(e)).toBe(false);
  });

  it("imaginea rămâne mereu inclusă chiar dacă tot desenul e într-un colț exterior", () => {
    const e = computeExtent([s([[-0.8, -0.8], [-0.5, -0.5]])]);
    // maxX/maxY rămân 1 (imaginea), nu -0.5; minX/minY primesc INK_MARGIN (au ieșit din imagine).
    expect(e).toEqual({ minX: -0.8 - INK_MARGIN, minY: -0.8 - INK_MARGIN, maxX: 1, maxY: 1 });
  });

  it("clamp la banda [DRAWABLE_MIN, DRAWABLE_MAX] — INK_MARGIN nu poate depăși plafonul", () => {
    const e = computeExtent([s([[-5, -5], [10, 10]])]);
    expect(e).toEqual({ minX: DRAWABLE_MIN, minY: DRAWABLE_MIN, maxX: DRAWABLE_MAX, maxY: DRAWABLE_MAX });
  });

  it("INK_MARGIN doar pe laturile care au ieșit din imagine (un desen strict peste rămâne unit)", () => {
    // Iese DOAR pe dreapta → doar maxX primește margine; celelalte 3 rămân 0/0/1.
    const e = computeExtent([s([[0.2, 0.2], [1.5, 0.8]])]);
    expect(e).toEqual({ minX: 0, minY: 0, maxX: 1.5 + INK_MARGIN, maxY: 1 });
  });

  it("ancora unui text din bandă intră în extent (cu INK_MARGIN)", () => {
    const e = computeExtent([{ color: "#211d18", size: 12, kind: "text", text: "notă", points: [[1.4, -0.2]] }]);
    expect(e).toEqual({ minX: 0, minY: -0.2 - INK_MARGIN, maxX: 1.4 + INK_MARGIN, maxY: 1 });
  });
});

describe("validateSketchNote — nota autorului, separată de desen (2026-07-16)", () => {
  it("acceptă null/undefined/gol → null (opțională)", () => {
    expect(validateSketchNote(null)).toEqual({ ok: true, value: null });
    expect(validateSketchNote(undefined)).toEqual({ ok: true, value: null });
    expect(validateSketchNote("   ")).toEqual({ ok: true, value: null });
  });

  it("trimuiește textul valid", () => {
    expect(validateSketchNote("  am vrut să zic X  ")).toEqual({ ok: true, value: "am vrut să zic X" });
  });

  it("respinge peste MAX_SKETCH_NOTE_LENGTH", () => {
    expect(validateSketchNote("x".repeat(MAX_SKETCH_NOTE_LENGTH + 1))).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });

  it("respinge non-string", () => {
    expect(validateSketchNote(42).ok).toBe(false);
  });
});

describe("duplicateTextStroke", () => {
  const textStroke = {
    color: "#211d18",
    size: 12,
    kind: "text" as const,
    text: "Șarpantă",
    points: [[0.4, 0.5]] as Point[],
    angle: 0.3,
  };

  it("adaugă o copie deplasată diagonal și o raportează ca selecție nouă", () => {
    const result = duplicateTextStroke([textStroke], 0);
    expect(result).not.toBeNull();
    expect(result!.strokes).toHaveLength(2);
    expect(result!.newIndex).toBe(1);

    const copy = result!.strokes[1];
    expect(copy.points[0]).toEqual([0.4 + TEXT_DUPLICATE_OFFSET, 0.5 + TEXT_DUPLICATE_OFFSET]);
    // Restul proprietăților rămân identice cu originalul.
    expect(copy.text).toBe(textStroke.text);
    expect(copy.color).toBe(textStroke.color);
    expect(copy.size).toBe(textStroke.size);
    expect(copy.angle).toBe(textStroke.angle);
  });

  it("nu modifică array-ul original (fără mutație)", () => {
    const strokes = [textStroke];
    duplicateTextStroke(strokes, 0);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points[0]).toEqual([0.4, 0.5]);
  });

  it("un text în colțul imaginii se poate deplasa în banda pasteboard", () => {
    // Pre-pasteboard clamp-ul era la 1 (marginea imaginii); acum copia poate aluneca în bandă.
    const result = duplicateTextStroke([{ ...textStroke, points: [[1, 1]] as Point[] }], 0);
    expect(result!.strokes[1].points[0]).toEqual([1 + TEXT_DUPLICATE_OFFSET, 1 + TEXT_DUPLICATE_OFFSET]);
  });

  it("ancora rămâne clampată la marginea pasteboard-ului (DRAWABLE_MAX = 2)", () => {
    const result = duplicateTextStroke([{ ...textStroke, points: [[2, 2]] as Point[] }], 0);
    expect(result!.strokes[1].points[0]).toEqual([2, 2]);
  });

  it("întoarce null pentru un stroke care nu e text", () => {
    expect(duplicateTextStroke([{ color: "#211d18", size: 4, points: [[0.1, 0.1], [0.2, 0.2]] as Point[] }], 0)).toBeNull();
  });

  it("întoarce null la index invalid", () => {
    expect(duplicateTextStroke([textStroke], 1)).toBeNull();
    expect(duplicateTextStroke([textStroke], -1)).toBeNull();
    expect(duplicateTextStroke([], 0)).toBeNull();
  });

  it("refuză duplicarea la plafonul MAX_STROKES (nu depășește silențios limita serverului)", () => {
    const full = Array.from({ length: MAX_STROKES }, () => textStroke);
    expect(duplicateTextStroke(full, 0)).toBeNull();
  });
});

describe("bara continuă de culoare", () => {
  it("capetele barei: alb sus (0), negru jos (100)", () => {
    expect(colorAtRampPosition(0)).toBe("#ffffff");
    expect(colorAtRampPosition(100)).toBe("#000000");
  });

  it("fiecare oprire e atinsă EXACT de slider (pas 1) — culorile de brand rămân selectabile", () => {
    for (const stop of COLOR_RAMP_STOPS) {
      expect(Number.isInteger(stop.at)).toBe(true);
      expect(colorAtRampPosition(stop.at)).toBe(stop.color);
    }
  });

  it("poziția implicită a editorului (90) = grafitul, prima culoare din paleta de brand", () => {
    expect(colorAtRampPosition(90)).toBe(STROKE_COLORS[0]);
  });

  it("între două opriri interpolează (culoare nouă, valabilă, între vecine)", () => {
    const mid = colorAtRampPosition(37.5); // între #d97a1e (30) și #b0463c (45)
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
    expect(mid).not.toBe("#d97a1e");
    expect(mid).not.toBe("#b0463c");
  });

  it("orice poziție produce un hex acceptat de validarea serverului", () => {
    for (let p = 0; p <= 100; p += 1) {
      const stroke = { color: colorAtRampPosition(p), size: 8, points: [[0.1, 0.1], [0.2, 0.2]] };
      expect(validateStrokes([stroke]).ok).toBe(true);
    }
  });

  it("valori în afara intervalului se clamp-uiesc la capete", () => {
    expect(colorAtRampPosition(-20)).toBe("#ffffff");
    expect(colorAtRampPosition(999)).toBe("#000000");
    expect(colorAtRampPosition(Number.NaN)).toBe("#ffffff");
  });

  it("gradientul CSS folosește exact aceleași opriri ca funcția de culoare", () => {
    const css = colorRampGradient();
    for (const stop of COLOR_RAMP_STOPS) {
      expect(css).toContain(`${stop.color} ${stop.at}%`);
    }
  });
});

// ── Stack de foi (2026-08-08) ────────────────────────────────────────────────────────────────────
// „Rețeta" fundalului unei schițe: ce foi erau aprinse când s-a apăsat „Schițează peste".
describe("validateBaseSketchIds", () => {
  it("null/undefined → listă goală (schiță pornită de pe detaliul gol)", () => {
    expect(validateBaseSketchIds(null)).toEqual({ ok: true, value: [] });
    expect(validateBaseSketchIds(undefined)).toEqual({ ok: true, value: [] });
  });

  it("listă goală rămâne goală", () => {
    expect(validateBaseSketchIds([])).toEqual({ ok: true, value: [] });
  });

  it("păstrează ORDINEA primită (de jos în sus = ordinea de desenare)", () => {
    const result = validateBaseSketchIds([UUID_C, UUID_A, UUID_B]);
    expect(result).toEqual({ ok: true, value: [UUID_C, UUID_A, UUID_B] });
  });

  it("deduplică păstrând PRIMA apariție (poziția în stivă e dată de prima desenare)", () => {
    const result = validateBaseSketchIds([UUID_A, UUID_B, UUID_A, UUID_A]);
    expect(result).toEqual({ ok: true, value: [UUID_A, UUID_B] });
  });

  it("respinge ce nu e array", () => {
    expect(validateBaseSketchIds("nu-i array")).toEqual({ ok: false, error: "INVALID_STACK" });
    expect(validateBaseSketchIds({ 0: UUID_A })).toEqual({ ok: false, error: "INVALID_STACK" });
    expect(validateBaseSketchIds(42)).toEqual({ ok: false, error: "INVALID_STACK" });
  });

  it("respinge elemente care nu sunt UUID-uri (payload ostil din client)", () => {
    expect(validateBaseSketchIds([UUID_A, "'; DROP TABLE sketches;--"])).toEqual({
      ok: false,
      error: "INVALID_STACK",
    });
    expect(validateBaseSketchIds([123])).toEqual({ ok: false, error: "INVALID_STACK" });
    expect(validateBaseSketchIds([null])).toEqual({ ok: false, error: "INVALID_STACK" });
  });

  it("acceptă exact la plafon, respinge peste", () => {
    // UUID-uri distincte generate determinist, ca deduplicarea să nu ascundă testul de plafon.
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`);

    expect(validateBaseSketchIds(ids(MAX_STACK_DEPTH)).ok).toBe(true);
    expect(validateBaseSketchIds(ids(MAX_STACK_DEPTH + 1))).toEqual({
      ok: false,
      error: "STACK_TOO_DEEP",
    });
  });

  it("plafonul se aplică DUPĂ deduplicare — 100 de repetări ale aceluiași id e o listă de 1", () => {
    const spam = Array.from({ length: 100 }, () => UUID_A);
    expect(validateBaseSketchIds(spam)).toEqual({ ok: true, value: [UUID_A] });
  });
});

// Compunerea stack-ului pentru randare: motorul de desenare nu știe din ce foaie vine un stroke,
// deci un stack e doar o listă concatenată — ordinea decide ce se vede deasupra.
describe("composeStackStrokes", () => {
  it("concatenează în ordinea dată (ultima foaie desenează deasupra)", () => {
    const result = composeStackStrokes([
      { strokes: [strokeOf("#111111")] },
      { strokes: [strokeOf("#222222"), strokeOf("#333333")] },
    ]);
    expect(result.map((s) => s.color)).toEqual(["#111111", "#222222", "#333333"]);
  });

  it("ignoră foile fără stroke-uri (ciornă goală) fără să rupă ordinea celorlalte", () => {
    const result = composeStackStrokes([
      { strokes: [strokeOf("#111111")] },
      { strokes: null },
      { strokes: [strokeOf("#222222")] },
    ]);
    expect(result.map((s) => s.color)).toEqual(["#111111", "#222222"]);
  });

  it("stack gol → listă goală (nu aruncă)", () => {
    expect(composeStackStrokes([])).toEqual([]);
    expect(composeStackStrokes([{ strokes: null }])).toEqual([]);
  });

  it("nu mută stroke-urile din foile sursă (fără mutație pe input)", () => {
    const layer = { strokes: [strokeOf("#111111")] };
    const before = [...layer.strokes];
    composeStackStrokes([layer, { strokes: [strokeOf("#222222")] }]);
    expect(layer.strokes).toEqual(before);
  });

  it("rezultatul rămâne valid pentru serverul de validare (stroke-uri neatinse structural)", () => {
    const composed = composeStackStrokes([
      { strokes: [strokeOf("#211d18")] },
      { strokes: [strokeOf("#b0463c")] },
    ]);
    expect(validateStrokes(composed).ok).toBe(true);
  });
});

// BUG găsit 2026-08-18: rezolvarea unui stack care conține adnotarea autorului ca fundal căuta doar în
// teanc (sketch), niciodată în adnotări — un id valid, existent, era pierdut tăcut la vizualizarea unei
// schițe deja publicate (deși mergea corect în editorul care citește direct din DB).
describe("resolveStackLayers", () => {
  it("rezolvă un id găsit în teanc, ca sursă sketch", () => {
    const sketchById = new Map([[UUID_A, { strokes: [strokeOf("#111111")] }]]);
    const result = resolveStackLayers([UUID_A], sketchById, new Map());
    expect(result).toEqual([{ id: UUID_A, source: "sketch", layer: { strokes: [strokeOf("#111111")] } }]);
  });

  it("rezolvă un id găsit DOAR în adnotări, ca sursă annotation (regresia bug-ului)", () => {
    const annotationById = new Map([[UUID_A, { strokes: [strokeOf("#222222")] }]]);
    const result = resolveStackLayers([UUID_A], new Map(), annotationById);
    expect(result).toEqual([{ id: UUID_A, source: "annotation", layer: { strokes: [strokeOf("#222222")] } }]);
  });

  it("păstrează ordinea din rețetă cu surse amestecate (adnotare jos, schiță deasupra)", () => {
    const sketchById = new Map([[UUID_B, { strokes: [strokeOf("#333333")] }]]);
    const annotationById = new Map([[UUID_A, { strokes: [strokeOf("#111111")] }]]);
    const result = resolveStackLayers([UUID_A, UUID_B], sketchById, annotationById);
    expect(result.map((r) => r.source)).toEqual(["annotation", "sketch"]);
    expect(result.map((r) => r.id)).toEqual([UUID_A, UUID_B]);
  });

  it("sare tăcut un id dispărut din ambele surse (foaie ștearsă între timp)", () => {
    const sketchById = new Map([[UUID_A, { strokes: [strokeOf("#111111")] }]]);
    const result = resolveStackLayers([UUID_A, UUID_C], sketchById, new Map());
    expect(result.map((r) => r.id)).toEqual([UUID_A]);
  });

  it("rețetă goală → listă goală", () => {
    expect(resolveStackLayers([], new Map(), new Map())).toEqual([]);
  });
});

// ── Ștergerea unei foi din stack (Faza B) ────────────────────────────────────────────────────────
// Regula ireversibilă a feature-ului: o foaie pe care s-a construit nu mai dispare complet.
describe("resolveSketchDeletionMode", () => {
  const AUTHOR = { isSketchAuthor: true, isDetailAuthor: false };
  const MODERATOR = { isSketchAuthor: false, isDetailAuthor: true };
  const STRAIN = { isSketchAuthor: false, isDetailAuthor: false };
  const LOCKED = new Date("2026-08-08T12:00:00Z");

  it("foaie NEblocată → ștergere completă, atât pentru autor cât și pentru moderator", () => {
    expect(resolveSketchDeletionMode({ lockedAt: null, ...AUTHOR })).toBe("HARD");
    expect(resolveSketchDeletionMode({ lockedAt: null, ...MODERATOR })).toBe("HARD");
  });

  it("foaie BLOCATĂ + autorul ei → ștergere parțială (își retrage doar numele)", () => {
    expect(resolveSketchDeletionMode({ lockedAt: LOCKED, ...AUTHOR })).toBe("PARTIAL");
  });

  it("foaie BLOCATĂ + moderator → REFUZ (nu retrage identitatea altcuiva, nici nu șterge)", () => {
    expect(resolveSketchDeletionMode({ lockedAt: LOCKED, ...MODERATOR })).toBe("FORBIDDEN");
  });

  it("autorul schiței care e ȘI autorul detaliului → tot parțială pe foaie blocată", () => {
    // Cazul adnotării nu ajunge aici (adnotările nu intră în stack), dar regula nu trebuie să depindă
    // de ordinea verificărilor: calitatea de autor al foii primează.
    expect(
      resolveSketchDeletionMode({ lockedAt: LOCKED, isSketchAuthor: true, isDetailAuthor: true }),
    ).toBe("PARTIAL");
  });

  it("străin → refuz, indiferent de blocare", () => {
    expect(resolveSketchDeletionMode({ lockedAt: null, ...STRAIN })).toBe("FORBIDDEN");
    expect(resolveSketchDeletionMode({ lockedAt: LOCKED, ...STRAIN })).toBe("FORBIDDEN");
  });
});

// Regresie pentru bug-ul de grupare din picker-ul de @mention (găsit la review 2026-08-08): foile cu
// identitate retrasă nu trebuie să împartă o cheie de grupare comună. Logica trăiește în
// `comments-section.tsx`, dar invariantul e de domeniu: o retragere nu se renumerotează cu alta.
describe("gruparea etichetelor pentru foile cu identitate retrasă", () => {
  // Replică exactă a lui `groupKey` din comments-section.tsx — dacă cele două diverg, testul cade.
  const groupKey = (s: { id: string; authorName: string | null; authorRemoved: boolean }) =>
    s.authorRemoved ? `removed:${s.id}` : (s.authorName ?? "");

  it("doi autori retrași primesc chei DISTINCTE (nu se numerotează împreună)", () => {
    const a = { id: UUID_A, authorName: null, authorRemoved: true };
    const b = { id: UUID_B, authorName: null, authorRemoved: true };
    expect(groupKey(a)).not.toBe(groupKey(b));
  });

  it("un retras NU se grupează cu un autor fără nume (cont fără nume ≠ retragere)", () => {
    const removed = { id: UUID_A, authorName: null, authorRemoved: true };
    const anonymous = { id: UUID_B, authorName: null, authorRemoved: false };
    expect(groupKey(removed)).not.toBe(groupKey(anonymous));
  });

  it("două schițe ale ACELUIAȘI autor neșters rămân grupate (ordinalul «schița N» se păstrează)", () => {
    const s1 = { id: UUID_A, authorName: "Ion", authorRemoved: false };
    const s2 = { id: UUID_B, authorName: "Ion", authorRemoved: false };
    expect(groupKey(s1)).toBe(groupKey(s2));
  });
});
