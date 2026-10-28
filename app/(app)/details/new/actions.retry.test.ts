import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  reprocess: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  draft: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  annotation: vi.fn(),
  removeAnnotation: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: async () => "owner" }));
vi.mock("@/lib/rate-limit", () => ({ limiters: {}, checkLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: mocks.reprocess }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: mocks.remove }));
vi.mock("@/lib/posthog-server", () => ({
  captureServerEvent: vi.fn(),
  flushPostHogEvents: async () => {},
}));
vi.mock("@/server/services/blobFileService", () => ({ canUseBlobUrls: async () => true }));
vi.mock("@/server/services/detailService", () => ({
  createDetail: mocks.create,
  createDetailDraft: mocks.draft,
  updateDetail: mocks.update,
  saveDetailDraft: mocks.save,
  publishDetailDraft: mocks.publish,
}));
vi.mock("@/server/services/sketchService", () => ({
  createAnnotation: mocks.annotation,
  updateAnnotation: mocks.annotation,
  deleteSketch: mocks.removeAnnotation,
}));
import { createDetailAction, saveNewDetailDraftAction } from "./actions";
import {
  updateDetailAction,
  saveDraftDetailAction,
  publishDraftDetailAction,
} from "../[id]/edit/actions";
function form() {
  const f = new FormData();
  Object.entries({
    detailId: "detail",
    title: "Titlu",
    location: "România",
    imageUrl: "staging",
    imageChanged: "1",
  }).forEach(([k, v]) => f.set(k, v));
  f.append("categoryIds", "cat");
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reprocess.mockResolvedValue({ ok: true, url: "processed" });
  for (const m of [mocks.create, mocks.draft, mocks.update, mocks.save, mocks.publish])
    m.mockResolvedValue({ ok: false, error: "INVALID_RESOURCE" });
  mocks.annotation.mockResolvedValue({ ok: true });
  mocks.removeAnnotation.mockResolvedValue({ ok: true });
});
// Imaginea s-a urcat CLIENT direct în Blob; validarea finală o face DetailService.
it.each([
  createDetailAction,
  saveNewDetailDraftAction,
  updateDetailAction,
  saveDraftDetailAction,
  publishDraftDetailAction,
])(
  "pastreaza originalul pana la confirmarea serviciului, curata numai rezultatul respins (%#)",
  async (action) => {
    const out = await action({ error: null }, form());
    expect(out.error).toBeTruthy();
    expect(mocks.reprocess).toHaveBeenCalledWith("staging", "details", "owner", {
      preserveOriginal: true,
    });
    expect(mocks.remove).toHaveBeenCalledWith(["processed"]);
    expect(mocks.remove).not.toHaveBeenCalledWith(["staging"]);
  },
);
it("nu sterge rezultatul cu commit incert", async () => {
  mocks.create.mockRejectedValueOnce(new Error("connection lost"));
  await expect(createDetailAction({ error: null }, form())).rejects.toThrow("connection lost");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("salvarea ciornei intoarce URL-ul persistat pentru urmatoarea salvare", async () => {
  mocks.save.mockResolvedValueOnce({ ok: true, detailId: "detail", oldImageUrl: null });
  const out = await saveDraftDetailAction({ error: null }, form());
  expect(out).toEqual({ error: null, imageUrl: "processed", sourceImageUrl: "staging" });
  expect(mocks.remove).toHaveBeenCalledWith(["staging"]);
});
// Detaliul e DEJA salvat aici — o adnotare care eșuează NU trebuie să piardă restul editării.
it("stergerea adnotarii blocate afiseaza bannerul existent", async () => {
  mocks.update.mockResolvedValueOnce({ ok: true, oldImageUrl: null });
  mocks.removeAnnotation.mockResolvedValueOnce({ ok: false, error: "ANNOTATION_LOCKED" });
  const f = form();
  f.set("imageChanged", "0");
  f.set("annotationSketchId", "annotation");
  await expect(updateDetailAction({ error: null }, f)).rejects.toThrow(
    "REDIRECT:/details/detail?sketch-delete=annotation-locked",
  );
});
it.each(["", "annotation"])(
  "crearea/actualizarea adnotarii respinse nu raporteaza succes (%s)",
  async (id) => {
    mocks.update.mockResolvedValueOnce({ ok: true, oldImageUrl: null });
    mocks.annotation.mockResolvedValueOnce({ ok: false, error: "INVALID_NOTE" });
    const f = form();
    f.set("imageChanged", "0");
    f.set("annotationSketchId", id);
    f.set(
      "annotationStrokes",
      JSON.stringify([{ kind: "free", points: [[0, 0]], color: "red", size: 1 }]),
    );
    await expect(updateDetailAction({ error: null }, f)).rejects.toThrow(
      "REDIRECT:/details/detail?annotation=failed",
    );
  },
);

it.each([
  [createDetailAction, mocks.create],
  [saveNewDetailDraftAction, mocks.draft],
  [updateDetailAction, mocks.update],
  [publishDraftDetailAction, mocks.publish],
] as const)("confirma serviciul inainte de a elimina staging-ul (%#)", async (action, service) => {
  service.mockResolvedValueOnce({ ok: true, detailId: "detail", oldImageUrl: null });
  await expect(action({error:null},form())).rejects.toThrow("REDIRECT:/details/detail");
  expect(mocks.remove).toHaveBeenCalledWith(["staging"]);
  expect(service.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
});
it("editarea fara imagine schimbata nu reproceseaza sau sterge imaginea existenta", async () => {
  mocks.update.mockResolvedValueOnce({ ok:true, oldImageUrl:null });
  const f=form(); f.set("imageChanged","0");
  await expect(updateDetailAction({error:null},f)).rejects.toThrow("REDIRECT:/details/detail");
  expect(mocks.reprocess).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
