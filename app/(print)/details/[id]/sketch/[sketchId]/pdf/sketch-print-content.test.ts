import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [hooks.states[i], (value: unknown) => { hooks.states[i] = value; }];
  },
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../../pdf/print-button", () => ({ PrintButton: "button" }));
vi.mock("@/components/sketch/sketch-viewer", () => ({ SketchViewer: "sketch-viewer" }));
import { SketchPrintContent } from "./sketch-print-content";

type Props = { children?: ReactNode; disabled?: boolean; role?: string; onLoad?: () => void; onError?: () => void; onRendered?: () => void };
function find(node: ReactNode, type: string): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (node.type === type) return node;
  return Children.toArray(node.props.children).map((child) => find(child, type)).find(Boolean);
}
function render(thumbnailUrl: string | null = null) {
  hooks.index = 0;
  return SketchPrintContent({ backHref: "/details/test", thumbnailUrl, imageUrl: "/pwa-192.png", alt: "Schita", strokes: [], children: "Metadate", footer: "Permalink" });
}
beforeEach(() => { hooks.states = []; hooks.index = 0; });

// Daca thumbnail-ul lipseste, exportul recompune imaginea din detaliul de baza, straturile publicate din reteta si traseele foii active.
it("blocheaza print pana cand imaginea si desenul sunt ambele gata", () => {
  let tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(true);
  find(tree, "img")!.props.onLoad!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(true);
  find(tree, "sketch-viewer")!.props.onRendered!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(false);
});
it("desenul gata inaintea imaginii nu permite print prematur", () => {
  let tree = render();
  find(tree, "sketch-viewer")!.props.onRendered!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(true);
});
it("eroarea de incarcare pastreaza print blocat si afiseaza mesajul", () => {
  let tree = render();
  find(tree, "sketch-viewer")!.props.onError!();
  find(tree, "img")!.props.onLoad!();
  find(tree, "sketch-viewer")!.props.onRendered!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(true);
  expect(find(tree, "div")!.props.children).toBeTruthy();
  const text = JSON.stringify(tree);
  expect(text).toContain("Imaginea schiței nu a putut fi încărcată");
});
it("thumbnail-ul existent pastreaza print disponibil", () => {
  expect(find(render("https://store.test/thumb.jpg"), "button")!.props.disabled).toBe(false);
});
