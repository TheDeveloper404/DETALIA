import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0, effects: [] as (() => (() => void) | void)[] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [hooks.states[i], (value: unknown) => { hooks.states[i] = value; }];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | void) => { hooks.effects.push(effect); },
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../../pdf/print-button", () => ({ PrintButton: "button" }));
vi.mock("@/components/sketch/sketch-viewer", () => ({ SketchViewer: "sketch-viewer" }));
import { SketchPrintContent } from "./sketch-print-content";

type Props = { children?: ReactNode; disabled?: boolean; role?: string; veil?: boolean; onLoad?: () => void; onError?: () => void; onRendered?: () => void; ref?: (img: unknown) => void };
function find(node: ReactNode, type: string): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (node.type === type) return node;
  return Children.toArray(node.props.children).map((child) => find(child, type)).find(Boolean);
}
function render(thumbnailUrl: string | null = null, imageUrl: string | null = "/pwa-192.png") {
  hooks.index = 0;
  return SketchPrintContent({ backHref: "/details/test", thumbnailUrl, imageUrl, alt: "Schita", strokes: [], children: "Metadate", footer: "Permalink" });
}
beforeEach(() => { hooks.states = []; hooks.index = 0; hooks.effects = []; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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

it("imaginea deja incarcata din cache (fara onLoad dupa hidratare) deblocheaza print", () => {
  let tree = render();
  find(tree, "img")!.props.ref!({ complete: true, naturalWidth: 192 });
  find(tree, "sketch-viewer")!.props.onRendered!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(false);
});
it("o imagine inca neincarcata la montare nu deblocheaza print", () => {
  let tree = render();
  find(tree, "img")!.props.ref!({ complete: false, naturalWidth: 0 });
  find(tree, "sketch-viewer")!.props.onRendered!();
  tree = render();
  expect(find(tree, "button")!.props.disabled).toBe(true);
});
it("fara thumbnail si fara imagine de detaliu, titlul si nota se pot tipari", () => {
  expect(find(render(null, null), "button")!.props.disabled).toBe(false);
});

// Detaliul de baza fara foi deschise ramane fara voal, ca in workspace.
it("exportul de baza poate pastra imaginea fara voal", () => {
  hooks.index = 0;
  const tree = SketchPrintContent({ backHref: "/details/test", thumbnailUrl: null, imageUrl: "/pwa-192.png", alt: "Detaliu", strokes: [], children: "Metadate", footer: "Permalink", veil: false });
  expect(find(tree, "sketch-viewer")!.props.veil).toBe(false);
});

// "Data si ora salvarii" — momentul exportului, nu momentul deschiderii paginii.
it("actualizeaza data la fiecare print, in ora Romaniei, si elimina listenerul la demontare", () => {
  vi.useFakeTimers();
  const browser = new EventTarget();
  vi.stubGlobal("window", browser);
  let tree = render(null, null);
  expect(find(tree, "time")).toBeUndefined();
  const cleanup = hooks.effects[0]();
  vi.setSystemTime(new Date("2026-10-30T12:34:56Z"));
  browser.dispatchEvent(new Event("beforeprint"));
  tree = render(null, null);
  expect(find(tree, "time")!.props).toMatchObject({ dateTime: "2026-10-30T12:34:56.000Z", children: "30.10.2026, 14:34:56" });
  vi.setSystemTime(new Date("2026-07-01T08:09:10Z"));
  browser.dispatchEvent(new Event("beforeprint"));
  tree = render(null, null);
  expect(find(tree, "time")!.props.children).toBe("01.07.2026, 11:09:10");
  cleanup!();
  vi.setSystemTime(new Date("2026-07-01T10:00:00Z"));
  browser.dispatchEvent(new Event("beforeprint"));
  expect(find(render(null, null), "time")!.props.children).toBe("01.07.2026, 11:09:10");
});
