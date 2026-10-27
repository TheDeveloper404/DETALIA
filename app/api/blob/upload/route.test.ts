import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), token: vi.fn(), status: vi.fn(),
  uploadLimiter: { name: "upload" }, mutationLimiter: { name: "mutation" },
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.status }) }) }) } }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: mocks.limit, limiters: { upload: mocks.uploadLimiter, mutation: mocks.mutationLimiter } }));
vi.mock("@/lib/blob-store", () => ({ blobStoreOptions: () => ({ token: "synthetic-private-token" }) }));
vi.mock("@vercel/blob/client", () => ({
  handleUpload: async (options: { body: { payload: { pathname: string; clientPayload: string } }; onBeforeGenerateToken: (path: string, kind: string) => Promise<unknown> }) => {
    const policy = await options.onBeforeGenerateToken(options.body.payload.pathname, options.body.payload.clientPayload);
    mocks.token(policy);
    return { type: "blob.generate-client-token", clientToken: "synthetic" };
  },
}));

import { POST } from "./route";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

const USER = "11111111-1111-4111-8111-111111111111";
const request = (path: string, kind = "image") => POST(new Request("https://detalia.ro/api/blob/upload", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: path, clientPayload: kind } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ user: { id: USER } });
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.status.mockResolvedValue([{ status: "ACTIVE" }]);
});
afterEach(() => vi.restoreAllMocks());

describe("token upload thumbnail direct", () => {
  // Regula aprobata: "u/<userId>/sketches/uploads/<uuid> si u/<userId>/canvases/uploads/<uuid>".
  it.each(["sketches", "canvases"])("permite staging %s, cu limita de imagine si cota de mutatii", async (folder) => {
    const response = await request(`u/${USER}/${folder}/uploads/raw.jpg`);
    expect(response.status).toBe(200);
    expect(mocks.token).toHaveBeenCalledWith(expect.objectContaining({ maximumSizeInBytes: MAX_IMAGE_BYTES, allowedContentTypes: expect.arrayContaining(["image/jpeg"]) }));
    expect(mocks.limit).toHaveBeenCalledWith(mocks.mutationLimiter, USER);
  });

  // Regula aprobata: "Doar upload-uri temporare ale userului; ... niciodata un thumbnail final".
  it.each([
    [`u/${USER}/sketches/final.jpg`, "image"],
    [`u/other-user/canvases/uploads/raw.jpg`, "image"],
    [`u/${USER}/canvases/uploads/raw.pdf`, "pdf"],
  ])("refuza %s (%s)", async (path, kind) => {
    expect((await request(path, kind)).status).toBe(400);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  // Regula domeniului: "Un cont suspendat/sters nu mai primeste token de upload".
  it("respinge contul suspendat chiar cu sesiune existenta", async () => {
    mocks.status.mockResolvedValue([{ status: "SUSPENDED" }]);
    expect((await request(`u/${USER}/sketches/uploads/raw.jpg`)).status).toBe(401);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("pastreaza cota existenta pentru imaginile de detaliu", async () => {
    expect((await request(`u/${USER}/details/raw.jpg`)).status).toBe(200);
    expect(mocks.limit).toHaveBeenCalledWith(mocks.uploadLimiter, USER);
  });
});
