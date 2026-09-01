import { describe, expect, it } from "vitest";

import { REFERENCE_WIDTH, resolveExportWidth, sketchTransform } from "./sketch-render";

// BUG găsit 2026-08-18: exportul thumbnail-ului de schiță (trimis ca `imageUrl` la „Trimite în Planșă")
// se făcea mereu la REFERENCE_WIDTH (1000px), indiferent de rezoluția reală a imaginii-mamă (până la
// 4096px) — pierdere de rezoluție la fiecare refolosire. Fix: urmează `naturalWidth`, plafonat la limita
// serverului.
describe("resolveExportWidth", () => {
  it("urmează naturalWidth când e sub plafon", () => {
    expect(resolveExportWidth(1600, 1000, 4096)).toBe(1600);
  });

  it("plafonează la `cap` când imaginea-mamă e peste limita serverului", () => {
    expect(resolveExportWidth(6000, 1000, 4096)).toBe(4096);
  });

  it("naturalWidth exact la plafon → rămâne neschimbat", () => {
    expect(resolveExportWidth(4096, 1000, 4096)).toBe(4096);
  });

  it("fără imagine-mamă (foaie goală) → fallback, nu plafonul", () => {
    expect(resolveExportWidth(null, 1000, 4096)).toBe(1000);
  });

  it("naturalWidth mic (imagine mică) → nu se mărește artificial peste rezoluția reală", () => {
    expect(resolveExportWidth(400, 1000, 4096)).toBe(400);
  });
});

// Pasteboard (2026-09-01): `sketchTransform` mapează normalizat→px pt un canvas care acoperă un
// `extent` (imaginea + desenul din afară). Fără extent = comportamentul vechi, byte-identic.
describe("sketchTransform — normalizat → px prin extent", () => {
  it("fără extent → cale veche: x·width, y·height, scale = width/REFERENCE_WIDTH", () => {
    const t = sketchTransform(800, 600);
    expect(t.toX(0)).toBe(0);
    expect(t.toX(1)).toBe(800);
    expect(t.toX(0.5)).toBe(400);
    expect(t.toY(1)).toBe(600);
    expect(t.scale).toBe(800 / REFERENCE_WIDTH);
  });

  it("extent explicit UNIT dă exact același rezultat ca fără extent (compatibil înapoi)", () => {
    const a = sketchTransform(800, 600);
    const b = sketchTransform(800, 600, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
    for (const x of [0, 0.25, 0.5, 1]) expect(b.toX(x)).toBe(a.toX(x));
    expect(b.scale).toBe(a.scale);
  });

  it("extent lat: centrul imaginii cade în sub-dreptunghiul [0,1], nu în centrul canvas-ului", () => {
    // extent [-1,2]² (banda maximă) pe un canvas 900×900 → imaginea ocupă px [300,600].
    const t = sketchTransform(900, 900, { minX: -1, minY: -1, maxX: 2, maxY: 2 });
    expect(t.toX(0)).toBe(300); // colțul imaginii
    expect(t.toX(1)).toBe(600);
    expect(t.toX(0.5)).toBe(450); // centrul imaginii = centrul canvas-ului aici (extent simetric)
    expect(t.toX(-1)).toBe(0); // marginea pasteboard-ului
    expect(t.toX(2)).toBe(900);
  });

  it("grosimea rămâne legată de lățimea IMAGINII, nu a canvas-ului", () => {
    // Imaginea ocupă 1/3 din canvas → scale trebuie să fie 1/3 din cel al unui canvas plin de aceeași lățime.
    const wide = sketchTransform(900, 900, { minX: -1, minY: -1, maxX: 2, maxY: 2 });
    const plain = sketchTransform(900, 900);
    expect(wide.scale).toBeCloseTo(plain.scale / 3, 10);
  });

  it("extent asimetric (doar în stânga): imaginea e împinsă spre dreapta canvas-ului", () => {
    const t = sketchTransform(1000, 500, { minX: -1, minY: 0, maxX: 1, maxY: 1 });
    expect(t.toX(-1)).toBe(0);
    expect(t.toX(0)).toBe(500);
    expect(t.toX(1)).toBe(1000);
    expect(t.toY(0)).toBe(0);
    expect(t.toY(1)).toBe(500);
  });
});
