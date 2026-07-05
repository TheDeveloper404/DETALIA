import { describe, expect, it } from "vitest";

import {
  MAX_ITEMS_PER_CANVAS,
  MAX_ITEM_SIZE,
  MAX_NAME_LENGTH,
  MAX_STATE_BYTES,
  MAX_Z,
  MIN_ITEM_SIZE,
  validateCanvasDocument,
  validateCanvasName,
} from "./plansa";

const DETAIL_ID = "11111111-1111-1111-1111-111111111111";

// Un item valid minim, refolosit ca bază în teste.
function item(over: Record<string, unknown> = {}) {
  return { id: "item-1", detailId: DETAIL_ID, x: 0.1, y: 0.1, width: 0.3, height: 0.2, z: 1, ...over };
}

function freeStroke(over: Record<string, unknown> = {}) {
  return { color: "#211d18", size: 8, points: [[0.1, 0.2]], kind: "free", ...over };
}

function doc(over: Record<string, unknown> = {}) {
  return { version: 1, items: [item()], strokes: [], ...over };
}

describe("validateCanvasName", () => {
  it("respinge gol / doar spații", () => {
    expect(validateCanvasName("").ok).toBe(false);
    expect(validateCanvasName("   ").ok).toBe(false);
    expect(validateCanvasName(null).ok).toBe(false);
  });

  it("respinge peste MAX_NAME_LENGTH", () => {
    expect(validateCanvasName("a".repeat(MAX_NAME_LENGTH + 1)).ok).toBe(false);
  });

  it("acceptă și face trim", () => {
    const r = validateCanvasName("  Planșa mea  ");
    expect(r).toEqual({ ok: true, value: "Planșa mea" });
  });
});

describe("validateCanvasDocument — server e sursa de adevăr pentru documentul planșei", () => {
  it("respinge ce nu e obiect", () => {
    expect(validateCanvasDocument(null).ok).toBe(false);
    expect(validateCanvasDocument([]).ok).toBe(false);
    expect(validateCanvasDocument("x").ok).toBe(false);
  });

  it("respinge version diferit de 1", () => {
    expect(validateCanvasDocument(doc({ version: 2 })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ version: "1" })).ok).toBe(false);
  });

  it("acceptă documentul minim valid (items + strokes goale)", () => {
    const r = validateCanvasDocument({ version: 1, items: [], strokes: [] });
    expect(r).toEqual({ ok: true, value: { version: 1, items: [], strokes: [] } });
  });

  it("respinge items ce nu e array", () => {
    expect(validateCanvasDocument(doc({ items: {} })).ok).toBe(false);
  });

  it("respinge peste MAX_ITEMS_PER_CANVAS", () => {
    const many = Array.from({ length: MAX_ITEMS_PER_CANVAS + 1 }, (_, i) => item({ id: `i${i}` }));
    expect(validateCanvasDocument(doc({ items: many }))).toEqual({ ok: false, error: "TOO_MANY_ITEMS" });
  });

  it("respinge detailId ne-uuid", () => {
    expect(validateCanvasDocument(doc({ items: [item({ detailId: "not-a-uuid" })] })).ok).toBe(false);
  });

  it("respinge id lipsă/gol", () => {
    expect(validateCanvasDocument(doc({ items: [item({ id: "" })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ id: 5 })] })).ok).toBe(false);
  });

  it("respinge width/height în afara [MIN_ITEM_SIZE, MAX_ITEM_SIZE]", () => {
    expect(validateCanvasDocument(doc({ items: [item({ width: MIN_ITEM_SIZE - 0.001 })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ width: MAX_ITEM_SIZE + 0.001 })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ height: 0 })] })).ok).toBe(false);
  });

  it("respinge x/y non-finite", () => {
    expect(validateCanvasDocument(doc({ items: [item({ x: Number.NaN })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ y: "1" })] })).ok).toBe(false);
  });

  it("respinge z non-integer sau peste MAX_Z", () => {
    expect(validateCanvasDocument(doc({ items: [item({ z: 1.5 })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ z: MAX_Z + 1 })] })).ok).toBe(false);
    expect(validateCanvasDocument(doc({ items: [item({ z: -(MAX_Z + 1) })] })).ok).toBe(false);
  });

  it("acceptă strokes goale (planșă cu doar imagini, fără desen)", () => {
    const r = validateCanvasDocument(doc({ strokes: [] }));
    expect(r.ok).toBe(true);
  });

  it("respinge strokes ce nu e array", () => {
    expect(validateCanvasDocument(doc({ strokes: {} })).ok).toBe(false);
  });

  it("delegă la validateStrokes pt strokes nevide (respinge stroke invalid)", () => {
    expect(validateCanvasDocument(doc({ strokes: [freeStroke({ color: "red" })] })).ok).toBe(false);
  });

  it("acceptă strokes nevide valide", () => {
    const r = validateCanvasDocument(doc({ strokes: [freeStroke()] }));
    expect(r.ok).toBe(true);
  });

  it("acceptă un document normal (mult sub MAX_STATE_BYTES)", () => {
    const r = validateCanvasDocument(doc());
    expect(r.ok).toBe(true);
  });

  it("respinge documentul peste MAX_STATE_BYTES (id anormal de lung, anti-abuz payload)", () => {
    const huge = item({ id: "x".repeat(MAX_STATE_BYTES + 1) });
    expect(validateCanvasDocument(doc({ items: [huge] }))).toEqual({ ok: false, error: "TOO_LARGE" });
  });
});
