import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeUser: vi.fn(), limit: vi.fn(), publish: vi.fn(), redirect: vi.fn(), capture: vi.fn(), flush: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: mocks.activeUser }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: mocks.limit, limiters: { mutation: {} } }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: mocks.capture, flushPostHogEvents: mocks.flush }));
vi.mock("@/server/services/sketchService", () => ({ publish: mocks.publish, saveStrokes: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { sendSketchAction } from "./sketch-actions";

const USER = "11111111-1111-4111-8111-111111111111";
const SKETCH = "33333333-3333-4333-8333-333333333333";
const DETAIL = "44444444-4444-4444-8444-444444444444";
const form = (thumbnailUrl?: string) => {
  const data = new FormData();
  data.set("sketchId", SKETCH);
  data.set("detailId", DETAIL);
  data.set("strokes", "[]");
  if (thumbnailUrl) data.set("thumbnailUrl", thumbnailUrl);
  return data;
};
const failedEvents = () => mocks.capture.mock.calls.filter(([, event]) => event === "sketch_publish_failed");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeUser.mockResolvedValue(USER);
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.publish.mockResolvedValue({ ok: true });
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT ${url}`); });
});

// Regula (Liviu 2026-11-07): publicarea esuata ajunge in PostHog cu un cod, ca sa o deosebim de lipsa de activitate.
describe("sketch_publish_failed", () => {
  it.each([
    ["limita", () => mocks.limit.mockResolvedValue({ ok: false }), form(), "RATE_LIMITED"],
    ["thumbnail strain", () => {}, form("https://evil.example/x.jpg"), "INVALID_THUMBNAIL"],
    ["refuz din publish", () => mocks.publish.mockResolvedValue({ ok: false, error: "EMPTY_STROKES" }), form(), "EMPTY_STROKES"],
  ])("%s → eveniment cu reason", async (_name, setup, data, reason) => {
    setup();
    const res = await sendSketchAction(data);
    expect(res.ok).toBe(false);
    expect(failedEvents()).toEqual([[USER, "sketch_publish_failed", { sketch_id: SKETCH, detail_id: DETAIL, reason }]]);
    expect(mocks.flush).toHaveBeenCalled();
  });

  it("publicarea reusita nu trimite evenimentul de esec", async () => {
    await expect(sendSketchAction(form())).rejects.toThrow(`REDIRECT /details/${DETAIL}`);
    expect(failedEvents()).toEqual([]);
    expect(mocks.capture).toHaveBeenCalledWith(USER, "sketch_published", expect.anything());
  });
});
