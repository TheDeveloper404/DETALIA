import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), status: vi.fn(), limit: vi.fn(), mutation: {},
  canvas: vi.fn(), update: vi.fn(), process: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.status }) }) }) } }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: mocks.limit, limiters: { mutation: mocks.mutation } }));
vi.mock("@/server/repos/plansaRepo", () => ({ getCanvasById: mocks.canvas, updateThumbnailOwned: mocks.update }));
vi.mock("@/server/repos/detailsRepo", () => ({}));
vi.mock("@/server/repos/sketchesRepo", () => ({}));
vi.mock("@/server/services/projectService", () => ({}));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: mocks.process }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: mocks.remove }));

// Real route -> fresh-status auth guard -> real plansaService; only persistence and Blob I/O are mocked.
import { POST } from "./route";

const OWNER = "11111111-1111-4111-8111-111111111111";
const CANVAS = "22222222-2222-4222-8222-222222222222";
const STORE = "https://teststore.private.blob.vercel-storage.com";
const STAGED = `${STORE}/u/${OWNER}/canvases/uploads/raw.jpg`;
const CLEAN = `${STORE}/u/${OWNER}/canvases/clean.jpg`;
const OLD = `${STORE}/u/${OWNER}/canvases/old.jpg`;

function request(body: unknown = { thumbnailUrl: STAGED }, origin: string | null = "https://detalia.test", id = CANVAS, raw = false) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin !== null) headers.set("Origin", origin);
  return POST(new Request(`https://detalia.test/api/canvases/${id}/thumbnail`, {
    method: "POST", headers, body: raw ? String(body) : JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
}
function untouched() {
  expect(mocks.process).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
  vi.stubEnv("BLOB_PRIVATE_STORE_ID", "teststore");
  mocks.auth.mockResolvedValue({ user: { id: OWNER, status: "ACTIVE" } });
  mocks.status.mockResolvedValue([{ status: "ACTIVE" }]);
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.canvas.mockResolvedValue({ id: CANVAS, ownerId: OWNER, thumbnailUrl: OLD });
  mocks.process.mockResolvedValue({ ok: true, url: CLEAN });
  mocks.update.mockResolvedValue({ previousUrl: OLD });
});
afterEach(() => vi.unstubAllEnvs());

// Regula (plansaService.ts): "ÎNTOTDEAUNA de la apelant (sesiune), niciodată din client."
it("persista doar imaginea reprocesata pentru owner-ul autentificat, apoi sterge imaginea veche", async () => {
  const response = await request({ thumbnailUrl: STAGED, ownerId: "forged-owner" });
  expect(response.status).toBe(200);
  expect(mocks.limit).toHaveBeenCalledWith(mocks.mutation, OWNER);
  expect(mocks.process).toHaveBeenCalledWith(STAGED, "canvases", OWNER);
  expect(mocks.update).toHaveBeenCalledWith(CANVAS, OWNER, CLEAN);
  expect(mocks.remove).toHaveBeenCalledWith([OLD]);
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.update.mock.invocationCallOrder[0]);
});

// Regula aprobata: "strict origin === requestURLorigin (missing/cross/null 403)".
it.each([null, "null", "https://attacker.test", "https://detalia.test.attacker.test"])("refuza originea %s inainte de orice efect", async (origin) => {
  expect((await request(undefined, origin)).status).toBe(403);
  untouched();
});

// Regula (require-active-api-user.ts): "SEC-04: status JWT e stale → re-check proaspăt din DB."
it.each(["SUSPENDED", "DELETED", "missing-user", "revoked-session"])("refuza %s chiar daca JWT-ul anterior era ACTIVE", async (status) => {
  if (status === "revoked-session") mocks.auth.mockResolvedValue(null);
  else mocks.status.mockResolvedValue(status === "missing-user" ? [] : [{ status }]);
  expect((await request()).status).toBe(401);
  untouched();
});

// Regula aprobata: "mutation limiter 429".
it("refuza depasirea cotei inaintea procesarii imaginii", async () => {
  mocks.limit.mockResolvedValue({ ok: false });
  expect((await request()).status).toBe(429);
  untouched();
});

// Regula aprobata: "typed body validation 400".
it.each([null, [], {}, { thumbnailUrl: 123 }, { thumbnailUrl: null }])("refuza corpul invalid %j", async (body) => {
  expect((await request(body)).status).toBe(400);
  untouched();
});
it("refuza JSON-ul invalid", async () => {
  expect((await request("{broken", undefined, CANVAS, true)).status).toBe(400);
  untouched();
});

// Regula (plansaService.ts): "O planșă nedeținută → NOT_FOUND".
it.each(["invalid-id", "missing", "foreign-owner"])("refuza plansa %s fara efecte Blob", async (scenario) => {
  if (scenario === "missing") mocks.canvas.mockResolvedValue(null);
  if (scenario === "foreign-owner") mocks.canvas.mockResolvedValue({ id: CANVAS, ownerId: "other" });
  expect((await request(undefined, undefined, scenario === "invalid-id" ? "invalid" : CANVAS)).status).toBe(404);
  untouched();
});

// Regula aprobata: "Doar upload-uri temporare ale userului; ... niciodata un thumbnail final".
it.each([
  `${STORE}/u/other/canvases/uploads/raw.jpg`,
  CLEAN,
  `${STORE}/u/${OWNER}/sketches/uploads/raw.jpg`,
  STAGED + "?alias=1",
  STAGED.replace("/uploads/raw.jpg", "/uploads/%72aw.jpg"),
  STAGED.replace("teststore.private", "foreignstore.private"),
  "https://attacker.test/image.jpg",
])("refuza URL-ul nestaging sau strain: %s", async (thumbnailUrl) => {
  expect((await request({ thumbnailUrl })).status).toBe(400);
  untouched();
});

// Regula aprobata: "decoder failures no writes/deletes".
it("esecul decodarii nu modifica thumbnail-ul existent", async () => {
  mocks.process.mockResolvedValue({ ok: false, error: "INVALID_TYPE" });
  expect((await request()).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

// Regula aprobata: "on false cleanup new file; after success cleanup old".
it("disparitia plansei la UPDATE curata numai imaginea noua", async () => {
  mocks.update.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([CLEAN]);
});

// Regula aprobata: "no exception cleanup (uncertain commit)"; "thrown 500 generic".
it.each(["lookup", "decoder", "update"])("eroarea %s este generica si nu sterge imagini la rezultat incert", async (stage) => {
  const failure = new Error("secret-db-host /private/file token=must-not-leak");
  if (stage === "lookup") mocks.canvas.mockRejectedValue(failure);
  if (stage === "decoder") mocks.process.mockRejectedValue(failure);
  if (stage === "update") mocks.update.mockRejectedValue(failure);
  const response = await request();
  expect(response.status).toBe(500);
  const body = await response.text();
  expect(body).not.toContain(failure.message);
  expect(body).toContain("INTERNAL_ERROR");
  expect(mocks.remove).not.toHaveBeenCalled();
  if (stage !== "update") expect(mocks.update).not.toHaveBeenCalled();
});
