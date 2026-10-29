import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

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
  value?: unknown;
  ref?: { current: unknown };
  type?: string;
  role?: string;
  onClick?: (event?: unknown) => void;
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
let clipboardDocument: EventTarget & { activeElement: unknown };
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
  clipboardDocument = Object.assign(new EventTarget(), { activeElement: null as unknown });
  vi.stubGlobal("document", clipboardDocument);
  vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
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

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it.each(["focus", "hover"])("paste cu %s foloseste preview-ul si upload-ul existente", async (activation) => {
  initial.categoryIds = ["category"];
  let tree = render();
  const zone = find(tree, (node) => node.props["data-testid"] === "detail-image-zone")!;
  zone.props.ref!.current = { contains: () => activation === "focus", matches: () => activation === "hover" };
  const file = new File(["image"], "clipboard.png", { type: "image/png" });
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { items: [
    { kind: "string", type: "text/plain", getAsFile: () => null },
    { kind: "file", type: "image/png", getAsFile: () => file },
  ] } });
  clipboardDocument.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(createUrl).toHaveBeenCalledWith(file);
  tree = render();
  const input = { value: "" };
  find(tree, (node) => node.props.name === "imageUrl")!.props.ref!.current = input;
  const requestSubmit = vi.fn();
  const form = find(tree, (node) => node.type === "form")!;
  form.props.ref!.current = { requestSubmit };
  await form.props.onSubmit!({ preventDefault: vi.fn(), nativeEvent: { submitter: undefined } });
  expect(upload).toHaveBeenCalledWith("details", file);
  expect(requestSubmit).toHaveBeenCalledOnce();
  expect(input.value).toBe("https://store.test/resource.jpg");
});

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it.each(["outside", "text", "mobile", "draw", "unmount"])("paste nu intervine pentru %s", (scenario) => {
  const tree = render();
  const zone = find(tree, (node) => node.props["data-testid"] === "detail-image-zone")!;
  zone.props.ref!.current = { contains: () => scenario !== "outside", matches: () => false };
  if (scenario === "mobile") vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  if (scenario === "draw") {
    find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Desenează"))!.props.onClick!();
    render();
  }
  if (scenario === "unmount") for (const effect of hooks.effects) effect.cleanup?.();
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { items: scenario === "text" ? [
    { kind: "string", type: "text/plain", getAsFile: () => null },
  ] : [
    { kind: "file", type: "image/png", getAsFile: () => new File(["image"], "clipboard.png", { type: "image/png" }) },
  ] } });
  clipboardDocument.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(createUrl).not.toHaveBeenCalled();
});

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it.each(["type", "size"])("imaginea lipita respecta validarea existenta de %s", (scenario) => {
  const tree = render();
  find(tree, (node) => node.props["data-testid"] === "detail-image-zone")!.props.ref!.current = { contains: () => true, matches: () => false };
  const file = new File(["image"], "clipboard.png", { type: scenario === "type" ? "image/gif" : "image/png" });
  if (scenario === "size") Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { items: [{ kind: "file", type: file.type, getAsFile: () => file }] } });
  clipboardDocument.dispatchEvent(event);
  expect(createUrl).not.toHaveBeenCalled();
  const alert = find(render(), (node) => node.props.role === "alert")!;
  expect(Children.toArray(alert.props.children).some((child) => typeof child === "string" && child.startsWith(scenario === "type" ? "Imaginea trebuie" : "Imaginea e prea mare"))).toBe(true);
});

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it("click activeaza zona pe desktop; Alege fisier si click pe mobil deschid selectorul", () => {
  const tree = render();
  const click = vi.fn();
  const focus = vi.fn();
  find(tree, (node) => node.props.id === "image")!.props.ref!.current = { click };
  const zoneButton = find(tree, (node) => Children.toArray(node.props.children).some((child) => isValidElement<Props>(child) && child.props.children === "Încarcă desenul"))!;
  zoneButton.props.onClick!({ currentTarget: { focus } });
  expect(focus).toHaveBeenCalledOnce();
  expect(click).not.toHaveBeenCalled();
  find(tree, (node) => node.type === "button" && node.props.children === "Alege fișier")!.props.onClick!();
  expect(click).toHaveBeenCalledOnce();
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  zoneButton.props.onClick!({ currentTarget: { focus } });
  expect(click).toHaveBeenCalledTimes(2);
});

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it("fisier A apoi paste B permite realegerea si publicarea fisierului A", async () => {
  initial.categoryIds = ["category"];
  let tree = render();
  const picker = { value: "a.png" };
  const a = new File(["a"], "a.png", { type: "image/png" });
  const b = new File(["b"], "b.png", { type: "image/png" });
  const input = find(tree, (node) => node.props.id === "image")!;
  input.props.ref!.current = picker;
  input.props.onChange!({ target: { files: [a] } });
  tree = render();
  find(tree, (node) => node.props["data-testid"] === "detail-image-zone")!.props.ref!.current = { contains: () => true, matches: () => false };
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { items: [{ kind: "file", type: b.type, getAsFile: () => b }] } });
  clipboardDocument.dispatchEvent(event);
  expect(picker.value).toBe("");
  tree = render();
  expect(find(tree, (node) => node.props.children === "b.png")).toBeTruthy();
  find(tree, (node) => node.props.id === "image")!.props.onChange!({ target: { files: [a] } });
  tree = render();
  expect(find(tree, (node) => node.props.children === "a.png")).toBeTruthy();
  find(tree, (node) => node.props.name === "imageUrl")!.props.ref!.current = { value: "" };
  const form = find(tree, (node) => node.type === "form")!;
  form.props.ref!.current = { requestSubmit: vi.fn() };
  await form.props.onSubmit!({ preventDefault: vi.fn(), nativeEvent: { submitter: undefined } });
  expect(upload).toHaveBeenLastCalledWith("details", a);
});

// Desktop/tableta: imaginea din clipboard se poate lipi cu Ctrl+V cand zona de upload are focus sau cursorul deasupra. Clickul activeaza zona; Alege fisier deschide selectorul clasic. Imaginea lipita foloseste aceleasi validari, preview si upload ca fisierul ales.
it("butoanele de mod sunt in afara zonei de paste si nu pierd adnotarea existenta", () => {
  initial.imageUrl = "https://store.test/original.png";
  initial.annotation = { id: "annotation", note: "Nota existenta", strokes: [{ kind: "free", color: "#000000", size: 0.01, points: [[0, 0], [1, 1]] }] };
  const tree = render();
  const modeButton = find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Desenează"))!;
  const zone = find(tree, (node) => node.props["data-testid"] === "detail-image-zone")!;
  expect(find(zone, (node) => node === modeButton)).toBeUndefined();
  clipboardDocument.activeElement = modeButton;
  zone.props.ref!.current = { contains: () => false, matches: () => false };
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { items: [{ kind: "file", type: "image/png", getAsFile: () => new File(["b"], "b.png", { type: "image/png" }) }] } });
  clipboardDocument.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(createUrl).not.toHaveBeenCalled();
  const unchanged = render();
  expect(find(unchanged, (node) => node.props.name === "annotationStrokes")!.props.value).toBe(JSON.stringify(initial.annotation.strokes));
  expect(find(unchanged, (node) => node.props.name === "annotationNote")!.props.value).toBe("Nota existenta");
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
