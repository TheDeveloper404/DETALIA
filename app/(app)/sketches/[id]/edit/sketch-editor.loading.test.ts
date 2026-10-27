import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value: unknown) => { state.values[index] = value; }];
  },
}));
vi.mock("next/dynamic", () => ({ default: () => "sketch-canvas" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), unstable_rethrow: vi.fn() }));
vi.mock("./sketch-actions", () => ({ saveStrokesAction: vi.fn(), sendSketchAction: vi.fn() }));
vi.mock("@/app/support-actions", () => ({ submitSupportRequestAction: vi.fn() }));

import type { Stroke } from "@/server/domain/sketch";
import { SketchEditor } from "./sketch-editor";

function find(node: ReactNode, predicate: (props: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) return;
  if (predicate(node.props)) return node.props;
  return Children.toArray(node.props.children).map((child) => find(child, predicate)).find(Boolean);
}

afterEach(() => { state.values = []; state.cursor = 0; });

// Regula aprobata: "daca am desenat ceva si am salvat in ciorna, trebuie si cand intru iar sa fie tot acolo."
it("asteapta montarea canvas-ului inainte sa permita salvarea sau publicarea ciornei", () => {
  const props = { sketchId: "sketch", detailId: "detail", imageUrl: "image", initialStrokes: [{}] as Stroke[], backgroundStrokes: [], initialNote: null, detailTitle: "Detail", authorId: null, authorName: null, authorRoleMain: null, authorVerified: false };
  const loading = SketchEditor(props);
  for (const label of ["Salvează ciornă", "Publică schița"]) {
    expect(find(loading, (p) => p["aria-label"] === label)?.disabled).toBe(true);
  }
  const canvas = find(loading, (p) => typeof p.onStrokesCount === "function");
  (canvas!.onStrokesCount as (count: number) => void)(props.initialStrokes.length);
  state.cursor = 0;
  const mounted = SketchEditor(props);
  for (const label of ["Salvează ciornă", "Publică schița"]) {
    expect(find(mounted, (p) => p["aria-label"] === label)?.disabled).toBe(false);
  }
});
