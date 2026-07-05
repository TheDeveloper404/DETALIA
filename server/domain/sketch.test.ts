import { describe, expect, it } from "vitest";

import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  MAX_STROKES_BYTES,
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
  validateStrokes,
} from "./sketch";

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
