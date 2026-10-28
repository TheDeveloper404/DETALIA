import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = {
  deps?: unknown[];
  setup: () => void | (() => void);
  cleanup?: () => void;
  changed: boolean;
};
const { hooks, upload, revoke, createUrl } = vi.hoisted(() => ({
  hooks: {
    states: [] as unknown[],
    refs: [] as { current: unknown }[],
    effects: [] as Effect[],
    state: 0,
    ref: 0,
    effect: 0,
    action: 0,
    draftResult: null as Record<string, unknown> | null,
  },
  upload: vi.fn(async () => "https://store.test/resource.jpg"),
  revoke: vi.fn(),
  createUrl: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.state++;
    if (!(index in hooks.states))
      hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next;
      },
    ];
  },
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) =>
    hooks.refs[hooks.ref++] ?? (hooks.refs[hooks.ref - 1] = { current: initial }),
  useActionState: (_action: unknown, initial: unknown) => [
    hooks.action++ % 2 === 1 ? (hooks.draftResult ?? initial) : initial,
    vi.fn(),
    false,
  ],
  useEffect: (setup: Effect["setup"], deps?: unknown[]) => {
    const index = hooks.effect++;
    const previous = hooks.effects[index];
    hooks.effects[index] = {
      setup,
      deps,
      cleanup: previous?.cleanup,
      changed: !previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i])),
    };
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/canvas-crop-picker", () => ({ CanvasCropPicker: () => null }));
vi.mock("@/components/sketch/sketch-viewer", () => ({ SketchViewer: () => null }));
vi.mock("@/lib/blob-upload", () => ({
  uploadImageToBlob: upload,
  uploadDocToBlob: upload,
  isHeicFile: () => false,
}));
vi.mock("./actions", () => ({ createDetailAction: vi.fn() }));
vi.mock("@/app/support-actions", () => ({ submitSupportRequestAction: vi.fn() }));

import { DetailForm, type DetailFormInitial } from "./detail-form";

type Props = {
  children?: ReactNode;
  id?: string;
  name?: string;
  ref?: { current: unknown };
  type?: string;
  onClick?: () => void;
  onStrokesCount?: (count: number) => void;
  onSubmit?: (event: unknown) => Promise<void>;
  onChange?: (event: unknown) => void;
  "aria-label"?: string;
  "data-testid"?: string;
};
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (predicate(node)) return node;
  return Children.toArray(node.props.children)
    .map((child) => find(child, predicate))
    .find(Boolean);
}
let initial: DetailFormInitial;
function render() {
  hooks.state = hooks.ref = hooks.effect = hooks.action = 0;
  const tree = DetailForm({ categories: [], initial });
  for (const effect of hooks.effects)
    if (effect.changed) {
      effect.cleanup?.();
      effect.cleanup = effect.setup() || undefined;
      effect.changed = false;
    }
  return tree;
}
async function uploadResource() {
  const tree = render();
  const resources = find(tree, (node) => node.props["data-testid"] === "resources-list")!;
  find(resources, (node) => node.type === "input" && node.props.type === "file")!.props.onChange!({
    target: { files: [new File(["image"], "res.jpg", { type: "image/jpeg" })], value: "res.jpg" },
  });
  await vi.waitFor(() => expect(createUrl).toHaveBeenCalled());
  return render();
}

beforeEach(() => {
  hooks.states.length = hooks.refs.length = hooks.effects.length = 0;
  hooks.state = hooks.ref = hooks.effect = hooks.action = 0;
  hooks.draftResult = null;
  vi.clearAllMocks();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revoke;
    },
  );
  createUrl.mockReturnValue("blob:resource");
  initial = {
    detailId: "detail",
    title: "Detaliu",
    description: null,
    categoryIds: [],
    imageUrl: null,
    location: "România",
    county: null,
    climateZone: null,
    seismicAg: "",
    seismicTc: "",
    snowLoad: "",
    windLoad: "",
    resources: [{ type: "IMAGE", value: "" }],
    annotation: null,
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// Regula aprobata: "Preview-uri de imagini: eliberarea memoriei imediat dupa eliminare/inlocuire."
it.each(["remove", "replace"])(
  "elibereaza preview-ul atasamentului la %s, fara a inchide formularul",
  async (operation) => {
    const tree = await uploadResource();
    expect(revoke).not.toHaveBeenCalled();
    const button = find(tree, (node) =>
      operation === "remove"
        ? node.props["aria-label"] === "Elimină resursa"
        : node.props.onClick !== undefined &&
          Children.toArray(node.props.children).includes("Schimbă"),
    );
    button!.props.onClick!();
    render();
    expect(revoke).toHaveBeenCalledWith("blob:resource");
    expect(hooks.refs[0].current).not.toContain("blob:resource");
  },
);

// Regula aprobata: "Preview-uri de imagini: eliberarea memoriei imediat dupa eliminare/inlocuire."
it("elibereaza si imaginea principala la inlocuire si eliminare", () => {
  let tree = render();
  const pick = (name: string) => {
    createUrl.mockReturnValueOnce(`blob:${name}`);
    find(tree, (node) => node.props.id === "image")!.props.onChange!({
      target: { files: [new File([name], `${name}.jpg`, { type: "image/jpeg" })] },
    });
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

// Re-salvează o ciornă existentă — rămâne pe editor, ca la autosave-ul schiței.
it.each([false, true])(
  "preia URL-ul procesat al ciornei numai daca imaginea nu a fost inlocuita intre timp (%s)",
  (replaced) => {
    const tree = render();
    const input = { value: replaced ? "new-selection" : "staging" };
    const field = find(tree, (node) => node.type === "input" && node.props.name === "imageUrl")!;
    field.props.ref!.current = input;
    hooks.draftResult = { error: null, imageUrl: "processed", sourceImageUrl: "staging" };
    render();
    expect(input.value).toBe(replaced ? "new-selection" : "processed");
  },
);

// Regula aprobata: "ar trebui sa ramana desenul de unde a ramas in ciorna".
it.each(["export", "upload"])("nu trimite imaginea veche daca desenul se schimba in timpul %s", async (phase) => {
  initial.categoryIds = ["category"];
  let tree = render();
  find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Desenează"))!.props.onClick!();
  tree = render();
  const input = { value: "" };
  find(tree, (node) => node.type === "input" && node.props.name === "imageUrl")!.props.ref!.current = input;
  const canvas = find(tree, (node) => typeof node.props.onStrokesCount === "function")!;
  canvas.props.onStrokesCount!(1);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const exportThumbnail = vi.fn(async () => { if (phase === "export") await pending; return new Blob(["drawing"], { type: "image/png" }); });
  canvas.props.ref!.current = { exportThumbnail };
  if (phase === "upload") upload.mockImplementationOnce(async () => { await pending; return "staging-old"; });
  tree = render();
  const form = find(tree, (node) => node.type === "form")!;
  const requestSubmit = vi.fn();
  form.props.ref!.current = { requestSubmit };
  const task = form.props.onSubmit!({ nativeEvent: { submitter: { dataset: { intent: "draft" } } }, preventDefault: vi.fn() });
  if (phase === "upload") await vi.waitFor(() => expect(upload).toHaveBeenCalled());
  canvas.props.onChange!([]);
  release();
  await task;
  expect(input.value).toBe("");
  expect(requestSubmit).not.toHaveBeenCalled();
  tree = render();
  await find(tree, (node) => node.type === "form")!.props.onSubmit!({ nativeEvent: { submitter: { dataset: { intent: "draft" } } }, preventDefault: vi.fn() });
  expect(requestSubmit).toHaveBeenCalledOnce();
});

it.each([[false,"draft"],[true,"draft"],[false,"publish"],[true,"publish"]] as const)("o editare de desen invalideaza exportul ciornei, inclusiv in timpul salvarii (%s, %s)",async (pending,intent)=>{
  initial.categoryIds=["category"];
  let tree=render();
  find(tree,node=>node.props.onClick!==undefined && Children.toArray(node.props.children).includes("Desenează"))!.props.onClick!();
  tree=render();
  const image=find(tree,node=>node.type==="input"&&node.props.name==="imageUrl")!;
  const input={value:"staging"};image.props.ref!.current=input;
  const canvas=find(tree,node=>typeof node.props.onStrokesCount==="function")!;
  canvas.props.onStrokesCount!(1);
  const exportThumbnail=vi.fn(async()=>new Blob(["new-drawing"],{type:"image/png"}));
  canvas.props.ref!.current={exportThumbnail};
  hooks.draftResult={error:null,imageUrl:"processed",sourceImageUrl:"staging"};
  if(!pending) tree=render();
  expect(canvas.props.onChange).toBeTypeOf("function");
  canvas.props.onChange!([{kind:"free",points:[[0,0],[1,1]],color:"red",size:1}]);
  tree=render();
  expect(input.value).toBe("");
  const form=find(tree,node=>node.type==="form")!;form.props.ref!.current={requestSubmit:vi.fn()};
  await form.props.onSubmit!({nativeEvent:{submitter:{dataset:{intent}}},preventDefault:vi.fn()});
  expect(exportThumbnail).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith("details",expect.any(File));
});
