import { type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Stroke } from "@/server/domain/sketch";

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  ref: 0,
  canvas: { width: 0, height: 0, getContext: vi.fn() },
  container: { clientWidth: 600, clientHeight: 450 },
  rect: { x: 0, y: 0, w: 600, h: 450 },
  ctx: { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "" },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => [harness.rect, vi.fn()],
  useRef: () => ({ current: harness.ref++ === 0 ? harness.container : harness.canvas }),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock("@/lib/sketch-render", () => ({ renderStrokes: vi.fn() }));
import { renderStrokes } from "@/lib/sketch-render";
import { SketchViewer } from "./sketch-viewer";

beforeEach(() => {
  vi.clearAllMocks();
  harness.effects = [];
  harness.ref = 0;
  harness.rect = { x: 0, y: 0, w: 600, h: 450 };
  harness.canvas.getContext.mockReturnValue(harness.ctx);
  vi.stubGlobal("Image", class { src = ""; });
});

it("nu anunta desen gata inainte ca imaginea sa furnizeze dimensiuni", () => {
  harness.rect = { x: 0, y: 0, w: 0, h: 0 };
  const onRendered = vi.fn();
  SketchViewer({ imageUrl: "/pwa-192.png", strokes: [], onRendered });
  for (const effect of harness.effects) effect();
  expect(onRendered).not.toHaveBeenCalled();
});

// Pe pagina detaliului, imaginea, adnotarile si schita vizibila au zoom si deplasare comune, doar pentru vizualizare.
it.each([1, 1.1, 3])("redeseneaza traseele la rezolutie %sx fara schimbarea dimensiunii CSS", (resolutionScale) => {
  const strokes: Stroke[] = [{ color: "#d22", size: 4, points: [[0.2, 0.3]] }];
  const tree = SketchViewer({ imageUrl: "/pwa-512.png", strokes, resolutionScale });
  const canvas = tree.props.children as ReactElement<{ width: number; height: number; style: { width: number; height: number } }>;
  harness.canvas.width = canvas.props.width;
  harness.canvas.height = canvas.props.height;
  for (const effect of harness.effects) effect();
  expect(canvas.props.width).toBe(Math.round(600 * resolutionScale));
  expect(canvas.props.height).toBe(Math.round(450 * resolutionScale));
  expect(canvas.props.style).toMatchObject({ width: 600, height: 450 });
  expect(renderStrokes).toHaveBeenCalledWith(harness.ctx, strokes, Math.round(600 * resolutionScale), Math.round(450 * resolutionScale));
  vi.unstubAllGlobals();
});
