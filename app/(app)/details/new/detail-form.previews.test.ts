import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { deps?: unknown[]; setup: () => void | (() => void); cleanup?: () => void; changed: boolean };
const { hooks, upload, revoke, createUrl } = vi.hoisted(() => ({
  hooks: { states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as Effect[], state: 0, ref: 0, effect: 0 },
  upload: vi.fn(async () => "https://store.test/resource.jpg"),
  revoke: vi.fn(), createUrl: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.state++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next; }];
  },
  useRef: (initial: unknown) => hooks.refs[hooks.ref++] ?? (hooks.refs[hooks.ref - 1] = { current: initial }),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
  useEffect: (setup: Effect["setup"], deps?: unknown[]) => {
    const index = hooks.effect++;
    const previous = hooks.effects[index];
    hooks.effects[index] = { setup, deps, cleanup: previous?.cleanup, changed: !previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i])) };
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/canvas-crop-picker", () => ({ CanvasCropPicker: () => null }));
vi.mock("@/components/sketch/sketch-viewer", () => ({ SketchViewer: () => null }));
vi.mock("@/lib/blob-upload", () => ({ uploadImageToBlob: upload, uploadDocToBlob: upload, isHeicFile: () => false }));
vi.mock("./actions", () => ({ createDetailAction: vi.fn() }));

import { DetailForm, type DetailFormInitial } from "./detail-form";

type Props = { children?: ReactNode; id?: string; type?: string; onClick?: () => void; onChange?: (event: unknown) => void; "aria-label"?: string; "data-testid"?: string };
function find(node: ReactNode, predicate: (node: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (predicate(node)) return node;
  return Children.toArray(node.props.children).map((child) => find(child, predicate)).find(Boolean);
}
let initial: DetailFormInitial;
function render() {
  hooks.state = hooks.ref = hooks.effect = 0;
  const tree = DetailForm({ categories: [], initial });
  for (const effect of hooks.effects) if (effect.changed) {
    effect.cleanup?.();
    effect.cleanup = effect.setup() || undefined;
    effect.changed = false;
  }
  return tree;
}
async function uploadResource() {
  const tree = render();
  const resources = find(tree, (node) => node.props["data-testid"] === "resources-list")!;
  find(resources, (node) => node.type === "input" && node.props.type === "file")!.props.onChange!({ target: { files: [new File(["image"], "res.jpg", { type: "image/jpeg" })], value: "res.jpg" } });
  await vi.waitFor(() => expect(createUrl).toHaveBeenCalled());
  return render();
}

beforeEach(() => {
  hooks.states.length = hooks.refs.length = hooks.effects.length = 0;
  hooks.state = hooks.ref = hooks.effect = 0;
  vi.clearAllMocks();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revoke; });
  createUrl.mockReturnValue("blob:resource");
  initial = { detailId: "detail", title: "Detaliu", description: null, categoryIds: [], imageUrl: null, location: "România", climateZone: null, seismicAg: "", seismicTc: "", snowLoad: "", windLoad: "", resources: [{ type: "IMAGE", value: "" }], annotation: null };
});
afterEach(() => { vi.unstubAllGlobals(); });

// Regula aprobata: "Preview-uri de imagini: eliberarea memoriei imediat dupa eliminare/inlocuire."
it.each(["remove", "replace"])("elibereaza preview-ul atasamentului la %s, fara a inchide formularul", async (operation) => {
  const tree = await uploadResource();
  expect(revoke).not.toHaveBeenCalled();
  const button = find(tree, (node) => operation === "remove" ? node.props["aria-label"] === "Elimină resursa" : node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Schimbă"));
  button!.props.onClick!();
  render();
  expect(revoke).toHaveBeenCalledWith("blob:resource");
  expect(hooks.refs[0].current).not.toContain("blob:resource");
});

// Regula aprobata: "Preview-uri de imagini: eliberarea memoriei imediat dupa eliminare/inlocuire."
it("elibereaza si imaginea principala la inlocuire si eliminare", () => {
  let tree = render();
  const pick = (name: string) => {
    createUrl.mockReturnValueOnce(`blob:${name}`);
    find(tree, (node) => node.props.id === "image")!.props.onChange!({ target: { files: [new File([name], `${name}.jpg`, { type: "image/jpeg" })] } });
    tree = render();
  };
  pick("first");
  expect(revoke).not.toHaveBeenCalled();
  pick("second");
  expect(revoke).toHaveBeenCalledWith("blob:first");
  expect(revoke).not.toHaveBeenCalledWith("blob:second");
  find(tree, (node) => node.props["aria-label"] === "Elimină imaginea")!.props.onClick!();
  render();
  expect(revoke).toHaveBeenCalledWith("blob:second");
});

it("pastreaza preview-ul folosit si il elibereaza la demontare", async () => {
  await uploadResource();
  expect(revoke).not.toHaveBeenCalled();
  for (const effect of hooks.effects) effect.cleanup?.();
  expect(revoke).toHaveBeenCalledWith("blob:resource");
});
