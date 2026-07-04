import { describe, expect, it } from "vitest";

import {
  MAX_NAME_LENGTH,
  MAX_STATE_BYTES,
  validateCanvasName,
  validateCanvasState,
} from "./canvas";

describe("validateCanvasName — server e sursa de adevăr pentru numele planșei", () => {
  it("trim + respinge gol", () => {
    expect(validateCanvasName("   ").ok).toBe(false);
    expect(validateCanvasName("").ok).toBe(false);
    expect(validateCanvasName(null as unknown)).toEqual({ ok: false, error: "EMPTY" });
  });

  it("întoarce valoarea trimmed pe nume valid", () => {
    expect(validateCanvasName("  Secțiune perete  ")).toEqual({
      ok: true,
      value: "Secțiune perete",
    });
  });

  it("respinge peste MAX_NAME_LENGTH", () => {
    const long = "a".repeat(MAX_NAME_LENGTH + 1);
    expect(validateCanvasName(long)).toEqual({ ok: false, error: "TOO_LONG" });
  });
});

describe("validateCanvasState — snapshot tldraw opac, mărginit", () => {
  it("respinge ce nu e obiect (array/primitiv/null)", () => {
    expect(validateCanvasState(null).ok).toBe(false);
    expect(validateCanvasState([]).ok).toBe(false);
    expect(validateCanvasState("{}" as unknown).ok).toBe(false);
    expect(validateCanvasState(42 as unknown).ok).toBe(false);
  });

  it("acceptă un obiect mic și îl întoarce ca atare", () => {
    const doc = { schema: {}, store: {} };
    expect(validateCanvasState(doc)).toEqual({ ok: true, value: doc });
  });

  it("respinge referințe circulare", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(validateCanvasState(circular)).toEqual({ ok: false, error: "NOT_OBJECT" });
  });

  it("respinge peste MAX_STATE_BYTES", () => {
    const big = { blob: "x".repeat(MAX_STATE_BYTES + 1) };
    expect(validateCanvasState(big)).toEqual({ ok: false, error: "TOO_LARGE" });
  });
});
