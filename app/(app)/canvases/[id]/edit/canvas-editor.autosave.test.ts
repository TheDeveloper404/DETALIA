import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const { refs, setters, push, saveDocument, saveThumbnail, upload } = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  setters: [] as ReturnType<typeof vi.fn>[],
  push: vi.fn(),
  saveDocument: vi.fn(async () => ({ ok: true })),
  saveThumbnail: vi.fn(async () => ({ ok: true })),
  upload: vi.fn<() => Promise<string>>(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (value: unknown) => { const ref = { current: value }; refs.push(ref); return ref; },
  useState: (value: unknown) => { const setter = vi.fn(); setters.push(setter); return [value, setter]; },
  useCallback: (callback: unknown) => callback,
  useEffect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), unstable_rethrow: vi.fn() }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@/components/plansa/plansa-canvas", () => ({ PlansaCanvas: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/lib/blob-upload", () => ({ uploadImageToBlob: upload }));
vi.mock("./canvas-actions", () => ({ saveCanvasDocumentAction: saveDocument, saveCanvasThumbnailAction: saveThumbnail, removeDetailFromCanvasAction: vi.fn() }));

import { PlansaCanvas } from "@/components/plansa/plansa-canvas";
import CanvasEditor from "./canvas-editor";

function findChange(node: ReactNode): (() => void) | undefined {
  if (!isValidElement<{ children?: ReactNode; onChange?: () => void }>(node)) return;
  if (node.type === PlansaCanvas) return node.props.onChange;
  return Children.toArray(node.props.children).map(findChange).find(Boolean);
}

function findNavigate(node: ReactNode): ((event: { preventDefault: () => void }) => void) | undefined {
  if (!isValidElement<{ children?: ReactNode; onNavigate?: (event: { preventDefault: () => void }) => void }>(node)) return;
  if (node.props.onNavigate) return node.props.onNavigate;
  return Children.toArray(node.props.children).map(findNavigate).find(Boolean);
}

afterEach(() => {
  refs.length = 0;
  setters.length = 0;
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Regula aprobata: "iesirea salveaza ultimul desen"; editorul nu accepta alt desen intre ultima salvare si navigare.
it.each([true, false])("iesirea pastreaza editorul blocat numai dupa salvare reusita: %s", async (success) => {
  vi.useFakeTimers({ now: new Date("2026-10-27T10:00:00Z") });
  saveDocument.mockResolvedValueOnce({ ok: success });
  upload.mockResolvedValue("https://storage.test/new-thumbnail.jpg");
  const tree = CanvasEditor({ canvasId: "canvas", name: "Plan", initialDocument: null, sources: [] });
  refs[0].current = {
    getDocument: () => ({ version: 1, items: [], strokes: [] }),
    exportThumbnail: async () => new Blob(["image"], { type: "image/jpeg" }),
  };
  const navigate = findNavigate(tree);
  expect(navigate).toBeTypeOf("function");
  navigate!({ preventDefault: vi.fn() });
  await vi.advanceTimersByTimeAsync(0);
  expect(setters[3]).toHaveBeenCalledWith(true);
  if (success) {
    expect(push).toHaveBeenCalledWith("/canvases");
    expect(setters[3]).not.toHaveBeenCalledWith(false);
  } else {
    expect(push).not.toHaveBeenCalled();
    expect(setters[3]).toHaveBeenCalledWith(false);
  }
});

// Regula: "thumbnail throttled" (canvas-editor.tsx); o eroare auxiliara nu trebuie sa epuizeze cota salvarii documentului.
it("pastreaza intervalul thumbnail-ului dupa esec, dar continua sa salveze documentul", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-27T10:00:00Z") });
  upload.mockRejectedValue(new Error("storage unavailable"));
  const tree = CanvasEditor({ canvasId: "canvas", name: "Plan", initialDocument: null, sources: [] });
  refs[0].current = {
    getDocument: () => ({ version: 1, items: [], strokes: [] }),
    exportThumbnail: async () => new Blob(["image"], { type: "image/jpeg" }),
  };
  const onChange = findChange(tree);
  expect(onChange).toBeTypeOf("function");
  onChange!();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(upload).toHaveBeenCalledTimes(1);
  onChange!();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(saveDocument).toHaveBeenCalledTimes(2);
  expect(upload).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(20_001);
  onChange!();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(saveDocument).toHaveBeenCalledTimes(3);
  expect(upload).toHaveBeenCalledTimes(2);
});
