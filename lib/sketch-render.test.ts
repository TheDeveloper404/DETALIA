import { getStroke } from "perfect-freehand";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Stroke } from "@/server/domain/sketch";
import { renderStrokes, resolveExportWidth } from "./sketch-render";

vi.mock("perfect-freehand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("perfect-freehand")>();
  return { ...actual, getStroke: vi.fn(actual.getStroke) };
});

describe("renderStrokes — geometrie reutilizata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "Path2D",
      class {
        constructor(public path: string) {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function stroke(): Stroke {
    return {
      kind: "free",
      color: "#123456",
      size: 8,
      points: [
        [0.1, 0.1],
        [0.2, 0.3],
        [0.5, 0.6],
        [0.8, 0.7],
      ],
    };
  }
  function context() {
    return {
      fill: vi.fn(),
      fillStyle: "",
      beginPath: vi.fn(),
      arc: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  it("nu recalculeaza traseele stabile la fiecare preview al creionului", () => {
    const committed = stroke();
    const ctx = context();
    renderStrokes(ctx, [committed], 1000, 700);
    const path = vi.mocked(ctx.fill).mock.calls[0][0];
    renderStrokes(ctx, [committed], 1000, 700);
    expect(getStroke).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ctx.fill).mock.calls[1][0]).toBe(path);
    expect(ctx.fillStyle).toBe(committed.color);
  });

  it("recalculeaza la resize si export la alta rezolutie", () => {
    const committed = stroke();
    const ctx = context();
    renderStrokes(ctx, [committed], 1000, 700);
    renderStrokes(ctx, [committed], 1200, 700);
    renderStrokes(ctx, [committed], 1200, 900);
    expect(getStroke).toHaveBeenCalledTimes(3);
    const paths = vi
      .mocked(ctx.fill)
      .mock.calls.map((call) => (call[0] as unknown as { path: string }).path);
    expect(new Set(paths).size).toBe(3);
  });

  it("modificarea inlocuieste stroke-ul; undo si redo pastreaza geometria si ordinea", () => {
    const original = stroke();
    const edited: Stroke = {
      ...original,
      color: "#abcdef",
      size: 16,
      points: original.points.map(([x, y]) => [x + 0.1, y]),
    };
    const ctx = context();
    renderStrokes(ctx, [original], 1000, 700);
    renderStrokes(ctx, [edited], 1000, 700);
    renderStrokes(ctx, [original], 1000, 700);
    renderStrokes(ctx, [edited], 1000, 700);
    expect(getStroke).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(ctx.fill).mock.calls;
    expect(calls[2][0]).toBe(calls[0][0]);
    expect(calls[3][0]).toBe(calls[1][0]);
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(ctx.fillStyle).toBe(edited.color);
  });

  it("un preview nou ramane nou, iar eliminarea nu redeseneaza stroke-ul eliminat", () => {
    const first = stroke();
    const second = stroke();
    const ctx = context();
    renderStrokes(ctx, [first, second], 1000, 700);
    renderStrokes(ctx, [first, { ...second, points: [...second.points, [0.9, 0.9]] }], 1000, 700);
    renderStrokes(ctx, [first], 1000, 700);
    expect(getStroke).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledTimes(5);
  });

  it("calea reutilizata este identica unei randari proaspete a acelorasi date", () => {
    const committed = stroke();
    const ctx = context();
    renderStrokes(ctx, [committed], 1000, 700);
    renderStrokes(ctx, [committed], 1000, 700);
    renderStrokes(ctx, [structuredClone(committed)], 1000, 700);
    const paths = vi
      .mocked(ctx.fill)
      .mock.calls.map((call) => (call[0] as unknown as { path: string }).path);
    expect(paths[1]).toBe(paths[2]);
  });

  it("textul, formele si punctele scurte pastreaza calea lor de randare", () => {
    const text: Stroke = { ...stroke(), kind: "text", text: "nota", angle: 0.2 };
    const rect: Stroke = { ...stroke(), kind: "rect" };
    const dot: Stroke = { ...stroke(), points: [[0.1, 0.2]] };
    const ctx = context();
    renderStrokes(ctx, [text, rect, dot], 1000, 700);
    renderStrokes(ctx, [text, rect, dot], 1000, 700);
    expect(getStroke).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenCalledWith(0.2);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
  });
});

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
