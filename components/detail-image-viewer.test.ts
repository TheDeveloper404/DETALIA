import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Effect = { setup: () => void | (() => void); cleanup?: () => void; deps?: unknown[]; changed: boolean };
const { hooks } = vi.hoisted(() => ({ hooks: {
  states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as Effect[], state: 0, ref: 0, effect: 0,
} }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = hooks.state++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [hooks.states[i], (next: unknown) => { hooks.states[i] = typeof next === "function" ? next(hooks.states[i]) : next; }];
  },
  useRef: (initial: unknown) => hooks.refs[hooks.ref++] ?? (hooks.refs[hooks.ref - 1] = { current: initial }),
  useEffect: (setup: Effect["setup"], deps?: unknown[]) => {
    const i = hooks.effect++;
    const old = hooks.effects[i];
    hooks.effects[i] = { setup, deps, cleanup: old?.cleanup, changed: !old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j])) };
  },
}));
vi.mock("next/image", () => ({ default: "img" }));

import { constrainImageView, DetailImageViewer, zoomImageView } from "./detail-image-viewer";

const frame = { width: 600, height: 450 };
const image = { width: 1200, height: 900 };
const base = { zoom: 1, x: 0, y: 0 };
type Props = {
  children?: ReactNode; ref?: { current: unknown }; style?: { transform?: string; touchAction?: string };
  "data-testid"?: string; "data-zoom"?: number; "aria-label"?: string; unoptimized?: boolean;
  onLoad?: (event: unknown) => void; onClick?: () => void;
  onPointerDown?: (event: unknown) => void; onPointerMove?: (event: unknown) => void;
  onPointerCancel?: (event: unknown) => void; onLostPointerCapture?: (event: unknown) => void;
};
function find(node: ReactNode, predicate: (element: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (predicate(node)) return node;
  return Children.toArray(node.props.children).map((child) => find(child, predicate)).find(Boolean);
}
let viewport: EventTarget & { getBoundingClientRect: () => object; setPointerCapture: ReturnType<typeof vi.fn> };
let touchSurface: EventTarget;
let resize: (entries: { contentRect: typeof frame }[]) => void;
function render() {
  hooks.state = hooks.ref = hooks.effect = 0;
  const tree = DetailImageViewer({ imageUrl: "https://images.test/detail.png", alt: "Detaliu", children: (zoom) => createElement("span", { "data-testid": "overlay", "data-resolution": zoom }) });
  (tree as ReactElement<Props>).props.ref!.current = viewport;
  find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.ref!.current = touchSurface;
  for (const effect of hooks.effects) if (effect.changed) {
    effect.cleanup?.(); effect.cleanup = effect.setup() || undefined; effect.changed = false;
  }
  return tree as ReactElement<Props>;
}
function pointer(id: number, x: number, y: number, type = "touch") {
  return { pointerId: id, clientX: x, clientY: y, pointerType: type, button: 0, currentTarget: viewport };
}
function touch(type: string, points: [number, number, number][]) {
  const event = Object.assign(new Event(type, { cancelable: true }), {
    targetTouches: points.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
  });
  touchSurface.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  hooks.states.length = hooks.refs.length = hooks.effects.length = 0;
  viewport = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 0, top: 0, ...frame }), setPointerCapture: vi.fn() });
  touchSurface = new EventTarget();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: typeof resize) { resize = callback; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => { for (const effect of hooks.effects) effect.cleanup?.(); vi.unstubAllGlobals(); });

describe("geometria zoom-ului imaginii", () => {
  // Pe pagina detaliului, imaginea, adnotarile si schita vizibila au zoom si deplasare comune, doar pentru vizualizare. Controalele +, - si reset sunt in imagine; Ctrl+rotita mareste pe desktop, pinch cu doua degete pe touch. Scroll-ul paginii ramane disponibil la dimensiunea initiala, iar Schiteaza este o actiune separata.
  it("pastreaza punctul de sub cursor la marire si centreaza la reset", () => {
    const zoomed = zoomImageView(base, 2, { x: 100, y: 50 }, frame, image);
    expect(zoomed).toEqual({ zoom: 2, x: -100, y: -50 });
    expect(zoomImageView(zoomed, 1, { x: 100, y: 50 }, frame, image)).toEqual(base);
  });
  it("limiteaza deplasarea la imaginea vizibila, inclusiv imagini inguste sau late", () => {
    expect(constrainImageView({ zoom: 2, x: 999, y: -999 }, frame, image)).toEqual({ zoom: 2, x: 300, y: -225 });
    expect(constrainImageView({ zoom: 2, x: 999, y: 999 }, frame, { width: 100, height: 1000 })).toEqual({ zoom: 2, x: 0, y: 225 });
    expect(constrainImageView({ zoom: 2, x: 999, y: 999 }, frame, { width: 1000, height: 100 })).toEqual({ zoom: 2, x: 300, y: 0 });
    expect(constrainImageView({ zoom: 0.1, x: 50, y: 50 }, frame, image)).toEqual(base);
    expect(constrainImageView({ zoom: 50, x: 0, y: 0 }, frame, image).zoom).toBe(3);
  });
});

describe("interactiunea viewer-ului, fara browser", () => {
  // Pe pagina detaliului, imaginea, adnotarile si schita vizibila au zoom si deplasare comune, doar pentru vizualizare. Controalele +, - si reset sunt in imagine; Ctrl+rotita mareste pe desktop, pinch cu doua degete pe touch. Scroll-ul paginii ramane disponibil la dimensiunea initiala, iar Schiteaza este o actiune separata.
  it("butoanele maresc imaginea si overlay-ul impreuna si cer sursa originala", () => {
    let tree = render();
    find(tree, (node) => !!node.props.onLoad)!.props.onLoad!({ currentTarget: { naturalWidth: 1200, naturalHeight: 900 } });
    expect(find(tree, (node) => !!node.props.onLoad)!.props.unoptimized).toBe(false);
    find(tree, (node) => node.props["aria-label"] === "Mărește imaginea")!.props.onClick!();
    tree = render();
    expect(tree.props["data-zoom"]).toBeCloseTo(1.1);
    expect(find(tree, (node) => !!node.props.onLoad)!.props.unoptimized).toBe(true);
    const content = find(tree, (node) => node.props["data-testid"] === "detail-image-content")!;
    expect(content.props.style?.transform).toBe("translate(0px, 0px) scale(1.1)");
    expect(find(content, (node) => node.props["data-testid"] === "overlay")).toBeTruthy();
    expect(find(content, (node) => node.props["data-testid"] === "overlay")!.props).toHaveProperty("data-resolution", 1.1);
    find(tree, (node) => node.props["aria-label"] === "Resetează zoom-ul")!.props.onClick!();
    tree = render();
    expect(tree.props["data-zoom"]).toBe(1);
    expect(tree.props.style?.touchAction).toBe("auto");
  });
  it("rotita normala ramane scroll, Ctrl+rotita face zoom, cleanup elimina listenerul", () => {
    let tree = render();
    find(tree, (node) => !!node.props.onLoad)!.props.onLoad!({ currentTarget: { naturalWidth: 1200, naturalHeight: 900 } });
    const ordinary = Object.assign(new Event("wheel", { cancelable: true }), { ctrlKey: false, deltaY: -100, clientX: 300, clientY: 225 });
    viewport.dispatchEvent(ordinary);
    expect(ordinary.defaultPrevented).toBe(false);
    const wheel = Object.assign(new Event("wheel", { cancelable: true }), { ctrlKey: true, deltaY: -100, clientX: 400, clientY: 225 });
    viewport.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    tree = render();
    expect(tree.props["data-zoom"]).toBeCloseTo(1.1);
    expect(find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.style?.transform).toContain("translate(-10");
    for (const effect of hooks.effects) effect.cleanup?.();
    const after = Object.assign(new Event("wheel", { cancelable: true }), { ctrlKey: true, deltaY: -100 });
    viewport.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
  it("pinch urmat de pan, anulare si resize pastreaza imaginea in cadru", () => {
    let tree = render();
    find(tree, (node) => !!node.props.onLoad)!.props.onLoad!({ currentTarget: { naturalWidth: 1200, naturalHeight: 900 } });
    touch("touchstart", [[1, 250, 225]]);
    touch("touchstart", [[1, 250, 225], [2, 350, 225]]);
    touch("touchmove", [[1, 250, 225], [2, 450, 225]]);
    tree = render();
    expect(tree.props["data-zoom"]).toBe(2);
    expect(tree.props.style?.touchAction).toBe("none");
    touch("touchend", [[1, 250, 225]]);
    touch("touchmove", [[1, 270, 225]]);
    tree = render();
    expect(find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.style?.transform).toBe("translate(70px, 0px) scale(2)");
    touch("touchcancel", []);
    touch("touchmove", [[1, 500, 500]]);
    resize([{ contentRect: { width: 100, height: 75 } }]);
    tree = render();
    expect(find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.style?.transform).toBe("translate(50px, 0px) scale(2)");
  });
  it("drag-ul cu mouse se opreste la pierderea capturii", () => {
    let tree = render();
    find(tree, (node) => !!node.props.onLoad)!.props.onLoad!({ currentTarget: { naturalWidth: 1200, naturalHeight: 900 } });
    find(tree, (node) => node.props["aria-label"] === "Mărește imaginea")!.props.onClick!();
    tree = render();
    tree.props.onPointerDown!(pointer(1, 300, 225, "mouse"));
    tree.props.onPointerMove!(pointer(1, 310, 225, "mouse"));
    tree = render();
    const transform = find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.style?.transform;
    expect(transform).toBe("translate(10px, 0px) scale(1.1)");
    tree.props.onLostPointerCapture!(pointer(1, 310, 225, "mouse"));
    tree.props.onPointerMove!(pointer(1, 500, 225, "mouse"));
    tree = render();
    expect(find(tree, (node) => node.props["data-testid"] === "detail-image-content")!.props.style?.transform).toBe(transform);
  });
  // Pe pagina detaliului, imaginea, adnotarile si schita vizibila au zoom si deplasare comune, doar pentru vizualizare. Controalele +, - si reset sunt in imagine; Ctrl+rotita mareste pe desktop, pinch cu doua degete pe touch. Scroll-ul paginii ramane disponibil la dimensiunea initiala, iar Schiteaza este o actiune separata.
  it.each([[0, 30], [30, 30]])("pinch vertical/diagonal (%i,%i) blocheaza scroll-ul doar cu doua degete", (dx, dy) => {
    let tree = render();
    find(tree, (node) => !!node.props.onLoad)!.props.onLoad!({ currentTarget: { naturalWidth: 1200, naturalHeight: 900 } });
    expect(touch("touchstart", [[1, 300 - dx, 225 - dy]]).defaultPrevented).toBe(false);
    expect(touch("touchmove", [[1, 300 - dx, 224 - dy]]).defaultPrevented).toBe(false);
    expect(touch("touchstart", [[1, 300 - dx, 225 - dy], [2, 300 + dx, 225 + dy]]).defaultPrevented).toBe(true);
    // Browser pointercancel cannot clear the separate touch gesture.
    tree.props.onPointerCancel!(pointer(1, 300 - dx, 225 - dy));
    expect(touch("touchmove", [[1, 300 - dx * 2, 225 - dy * 2], [2, 300 + dx * 2, 225 + dy * 2]]).defaultPrevented).toBe(true);
    tree = render();
    expect(tree.props["data-zoom"]).toBe(2);
    touch("touchend", []);
    for (const effect of hooks.effects) effect.cleanup?.();
    expect(touch("touchstart", [[1, 100, 100], [2, 200, 200]]).defaultPrevented).toBe(false);
  });
});
