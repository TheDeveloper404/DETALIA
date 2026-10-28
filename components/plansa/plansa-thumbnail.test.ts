import { afterEach, expect, it, vi } from "vitest";
import { renderCanvasThumbnail } from "./plansa-canvas";

afterEach(() => vi.unstubAllGlobals());

it("snapshotul asteapta imaginile si randeaza documentul curent, fara thumbnail vechi", async () => {
  let finishImage: () => void = () => {};
  const drawImage = vi.fn();
  const ctx = new Proxy(
    { drawImage },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
  );
  const toBlob = vi.fn((done: (blob: Blob) => void) => done(new Blob(["fresh"])));
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx, toBlob }) });
  vi.stubGlobal(
    "Image",
    class {
      onload?: () => void;
      naturalWidth = 100;
      naturalHeight = 100;
      set src(_value: string) {
        finishImage = () => this.onload?.();
      }
    },
  );
  const source = { detailId: "detail", imageUrl: "/api/files/detail/detail", title: "Titlu" };
  const task = renderCanvasThumbnail(
    {
      version: 1,
      items: [{ id: "placed", detailId: "detail", x: 0.2, y: 0.3, width: 0.3, height: 0.2, z: 1 }],
      strokes: [],
    },
    [source],
  );
  expect(toBlob).not.toHaveBeenCalled();
  finishImage();
  expect(await task).toBeInstanceOf(Blob);
  expect(drawImage).toHaveBeenCalledOnce();
  expect(toBlob).toHaveBeenCalledOnce();
});

it("o imagine care nu se incarca respinge partajarea, fara fallback vechi", async () => {
  vi.stubGlobal(
    "Image",
    class {
      onerror?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  await expect(
    renderCanvasThumbnail(null, [{ detailId: "detail", imageUrl: "/missing", title: "T" }]),
  ).rejects.toThrow("Imaginea plansei");
});
