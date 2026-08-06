import { describe, expect, it } from "vitest";

import {
  MAX_POINTS_PER_STROKE,
  MAX_SKETCH_NOTE_LENGTH,
  MAX_STROKES,
  MAX_STROKES_BYTES,
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
  colorAtRampPosition,
  STROKE_COLORS,
  colorRampGradient,
  COLOR_RAMP_STOPS,
  duplicateTextStroke,
  isSelfAnnotation,
  TEXT_DUPLICATE_OFFSET,
  type Point,
  validateSketchNote,
  validateStrokes,
} from "./sketch";

// Predicatul care separă ADNOTAREA autorului (nota lui pe propria imagine) de SCHIȚA altcuiva
// (contribuție, model fork/PR). E mirror-uit în SQL în sketchesRepo/detailsRepo/profileRepo.
describe("isSelfAnnotation", () => {
  it("autorul schiței == autorul detaliului → adnotare", () => {
    expect(isSelfAnnotation({ sketchAuthorId: "u1", detailAuthorId: "u1" })).toBe(true);
  });

  it("autori diferiți → schiță din teanc, nu adnotare", () => {
    expect(isSelfAnnotation({ sketchAuthorId: "u2", detailAuthorId: "u1" })).toBe(false);
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

  it("respinge puncte NEnormalizate (coordonate trebuie 0..1 față de imaginea-mamă)", () => {
    expect(validateStrokes([freeStroke({ points: [[1.5, 0.2]] })]).ok).toBe(false);
    expect(validateStrokes([freeStroke({ points: [[-0.1, 0.2]] })]).ok).toBe(false);
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

  it("ancora rămâne în [0,1] pentru un text lipit de marginea dreapta-jos", () => {
    const result = duplicateTextStroke([{ ...textStroke, points: [[1, 1]] as Point[] }], 0);
    expect(result!.strokes[1].points[0]).toEqual([1, 1]);
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
