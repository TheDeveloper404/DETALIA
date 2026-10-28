import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Stroke } from "@/server/domain/sketch";
const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  ref: 0,
  present: null as Stroke[] | null,
  effects: [] as (() => unknown)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  forwardRef: (render: unknown) => render,
  useReducer: (_reducer: unknown, initial: { present: Stroke[] }) => [
    { past: [], future: [], present: hooks.present ?? initial.present },
    vi.fn(),
  ],
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useRef: (initial: unknown) =>
    hooks.refs[hooks.ref++] ?? (hooks.refs[hooks.ref - 1] = { current: initial }),
  useEffect: (effect: () => unknown) => hooks.effects.push(effect),
  useCallback: (fn: unknown) => fn,
  useImperativeHandle: vi.fn(),
}));
import { SketchCanvas } from "./sketch-canvas";
const first = [
  {
    kind: "free",
    points: [
      [0, 0],
      [1, 1],
    ],
    color: "red",
    size: 1,
  },
] as Stroke[];
function render(onChange: (strokes: Stroke[]) => void) {
  hooks.ref = 0;
  hooks.effects = [];
  (SketchCanvas as unknown as (props: unknown, ref: unknown) => unknown)(
    { initialStrokes: first, onChange },
    null,
  );
  for (const effect of hooks.effects) effect();
}
beforeEach(() => {
  hooks.refs = [];
  hooks.present = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it("semnaleaza numai schimbarile de continut, inclusiv acelasi numar de trasee, undo si redo", () => {
  const changed = vi.fn();
  render(changed);
  expect(changed).not.toHaveBeenCalled();
  render(() => {});
  expect(changed).not.toHaveBeenCalled();
  const edited = [{ ...first[0], color: "blue" }] as Stroke[];
  hooks.present = edited;
  render(changed);
  expect(changed).toHaveBeenCalledExactlyOnceWith(edited);
  render(changed);
  expect(changed).toHaveBeenCalledTimes(1);
  hooks.present = first;
  render(changed);
  expect(changed).toHaveBeenCalledTimes(2);
  hooks.present = edited;
  render(changed);
  expect(changed).toHaveBeenCalledTimes(3);
});
