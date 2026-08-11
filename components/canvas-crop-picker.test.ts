import { describe, expect, it } from "vitest";

import { clampRect } from "./canvas-crop-picker";

// clampRect e singura logică pură din CanvasCropPicker (§7, Faza C) — restul e interacțiune de
// mouse/pointer, netestabilă unitar. Verifică: latura minimă (sub ea decupajul devine inutilizabil) și
// că rect-ul rămâne mereu în interiorul imaginii [0,1]x[0,1], indiferent în ce direcție a fost tras.
describe("clampRect", () => {
  it("lasă un rect valid neschimbat", () => {
    expect(clampRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 });
  });

  it("impune latura minimă (MIN_SIZE = 0.08) când e micșorat sub prag", () => {
    const r = clampRect({ x: 0.5, y: 0.5, w: 0.01, h: 0.01 });
    expect(r.w).toBeCloseTo(0.08);
    expect(r.h).toBeCloseTo(0.08);
  });

  it("respinge o lățime/înălțime peste 1 (clamp la imaginea întreagă)", () => {
    const r = clampRect({ x: 0, y: 0, w: 1.5, h: 2 });
    expect(r.w).toBe(1);
    expect(r.h).toBe(1);
  });

  it("trage rect-ul înapoi în cadru când x/y ies în afară pe stânga/sus (valori negative)", () => {
    const r = clampRect({ x: -0.3, y: -0.2, w: 0.4, h: 0.4 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("trage rect-ul înapoi în cadru când x+w/y+h depășesc 1 (dreapta/jos)", () => {
    const r = clampRect({ x: 0.8, y: 0.9, w: 0.4, h: 0.4 });
    expect(r.x).toBeCloseTo(0.6); // 1 - w
    expect(r.y).toBeCloseTo(0.6);
  });
});
