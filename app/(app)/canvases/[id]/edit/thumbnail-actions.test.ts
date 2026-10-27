import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeUser: vi.fn(), limit: vi.fn(), reprocess: vi.fn(), removeBlobs: vi.fn(),
  publish: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: mocks.activeUser }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: mocks.limit, limiters: { mutation: {} } }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: mocks.reprocess }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: mocks.removeBlobs }));
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: vi.fn(), flushPostHogEvents: vi.fn() }));
vi.mock("@/server/services/sketchService", () => ({ publish: mocks.publish, saveStrokes: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { sendSketchAction } from "../../../sketches/[id]/edit/sketch-actions";

const USER = "11111111-1111-4111-8111-111111111111";
const base = "https://testprivate.private.blob.vercel-storage.com";
const form = (folder: string, url = `${base}/u/${USER}/${folder}/uploads/raw.jpg`) => {
  const data = new FormData();
  data.set("sketchId", "33333333-3333-4333-8333-333333333333");
  data.set("detailId", "44444444-4444-4444-8444-444444444444");
  data.set("thumbnailUrl", url);
  data.set("strokes", "[]");
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "testprivate");
  mocks.activeUser.mockResolvedValue(USER);
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.reprocess.mockResolvedValue({ ok: true, url: `${base}/u/${USER}/processed.jpg` });
  mocks.publish.mockResolvedValue({ ok: true });
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT ${url}`); });
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
  { folder: "sketches", action: sendSketchAction },
])("thumbnail staging $folder", ({ folder, action }) => {
  // Regula aprobata: "Actions accepta doar surse canonice din prefixul staging al userului".
  it.each([
    `${base}/u/other-user/FOLDER/uploads/raw.jpg`,
    `${base}/u/${USER}/FOLDER/final.jpg`,
    `${base}/u/${USER}/resources/uploads/raw.jpg`,
    `${base.toUpperCase()}/u/${USER}/FOLDER/uploads/raw.jpg`,
    `https://foreign.private.blob.vercel-storage.com/u/${USER}/FOLDER/uploads/raw.jpg`,
  ])("respinge o sursa straina, finala sau necanonica: %s", async (url) => {
    expect(await action(form(folder, url.replace("FOLDER", folder)))).toMatchObject({ ok: false });
    expect(mocks.reprocess).not.toHaveBeenCalled();
    expect(mocks.removeBlobs).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  // Regula aprobata: "serverul valideaza ownership-ul si reprocesseaza imaginea".
  it("nu persista daca imaginea nu poate fi decodata/reprocesata", async () => {
    mocks.reprocess.mockResolvedValue({ ok: false });
    expect(await action(form(folder))).toMatchObject({ ok: false });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("nu citeste/transforma fisierul cand limita de mutatii a fost atinsa", async () => {
    mocks.limit.mockResolvedValue({ ok: false });
    expect(await action(form(folder))).toMatchObject({ ok: false });
    expect(mocks.reprocess).not.toHaveBeenCalled();
  });
});

// Regula existenta: "Pe succes → redirect la detaliu".
it("publica schita cu URL-ul reprocesat si pastreaza redirect-ul de succes", async () => {
  await expect(sendSketchAction(form("sketches"))).rejects.toThrow("REDIRECT /details/44444444-4444-4444-8444-444444444444");
  expect(mocks.reprocess).toHaveBeenCalledWith(`${base}/u/${USER}/sketches/uploads/raw.jpg`, "sketches", USER);
  expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ authorId: USER, thumbnailUrl: `${base}/u/${USER}/processed.jpg` }));
  expect(mocks.removeBlobs).not.toHaveBeenCalled();
});

it("curata thumbnail-ul reprocesat daca publicarea esueaza", async () => {
  mocks.publish.mockResolvedValue({ ok: false, error: "INVALID_STATE" });
  expect(await sendSketchAction(form("sketches"))).toMatchObject({ ok: false });
  expect(mocks.removeBlobs).toHaveBeenCalledWith([`${base}/u/${USER}/processed.jpg`]);
});
