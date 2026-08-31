import { describe, expect, it } from "vitest";

import { mapCanvasCoord, resolveExportWidth, strokesUsePasteboard } from "./sketch-render";
import type { Stroke } from "@/server/domain/sketch";

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

// Pasteboard (2026-08-31): stroke-urile pot avea coordonate în afara [0,1] (banda din jurul imaginii).
describe("mapCanvasCoord", () => {
  it("margin = 0 → identic cu n * extent (apelanții vechi neschimbați)", () => {
    expect(mapCanvasCoord(0, 1000)).toBe(0);
    expect(mapCanvasCoord(0.5, 1000)).toBe(500);
    expect(mapCanvasCoord(1, 1000)).toBe(1000);
  });

  it("cu margin, colțurile imaginii cad în interiorul retras, banda umple restul", () => {
    // margin 0.4 → suprafață = imagine * 1.8; imaginea ocupă 0.4/1.8 .. 1.4/1.8 din suprafață
    expect(mapCanvasCoord(-0.4, 1800, 0.4)).toBeCloseTo(0);
    expect(mapCanvasCoord(0, 1800, 0.4)).toBeCloseTo(400);
    expect(mapCanvasCoord(1, 1800, 0.4)).toBeCloseTo(1400);
    expect(mapCanvasCoord(1.4, 1800, 0.4)).toBeCloseTo(1800);
  });

  it("centrul imaginii rămâne centrul suprafeței", () => {
    expect(mapCanvasCoord(0.5, 1800, 0.4)).toBeCloseTo(900);
  });
});

describe("strokesUsePasteboard", () => {
  const s = (points: number[][]): Stroke => ({ color: "#211d18", size: 8, points: points as Stroke["points"] });

  it("false când toate punctele sunt în [0,1]", () => {
    expect(strokesUsePasteboard([s([[0, 0], [1, 1]]), s([[0.5, 0.5]])])).toBe(false);
  });

  it("true dacă un punct iese sub 0 sau peste 1 (pe oricare axă)", () => {
    expect(strokesUsePasteboard([s([[0.5, 0.5]]), s([[-0.2, 0.3]])])).toBe(true);
    expect(strokesUsePasteboard([s([[0.3, 1.2]])])).toBe(true);
  });

  it("false pe listă goală", () => {
    expect(strokesUsePasteboard([])).toBe(false);
  });
});
