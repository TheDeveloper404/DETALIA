import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ruta e publică în proxy (AUD-06) — singura autorizare rămâne CRON_SECRET, verificat aici.

const { sendWeeklyDigests } = vi.hoisted(() => ({ sendWeeklyDigests: vi.fn() }));

vi.mock("@/server/services/digestService", () => ({ sendWeeklyDigests }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { GET } from "./route";

function req(authorization?: string): Request {
  return new Request("https://detalia.ro/api/cron/weekly-digest", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/weekly-digest — CRON_SECRET", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret-de-test";
    sendWeeklyDigests.mockResolvedValue({ built: 3, sent: 3 });
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  it("header lipsă → 401, fără trimitere", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(sendWeeklyDigests).not.toHaveBeenCalled();
  });

  it("secret greșit → 401, fără trimitere", async () => {
    const res = await GET(req("Bearer altceva"));
    expect(res.status).toBe(401);
    expect(sendWeeklyDigests).not.toHaveBeenCalled();
  });

  it("CRON_SECRET absent din env → 401 (fail-closed), chiar și cu header", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
    expect(sendWeeklyDigests).not.toHaveBeenCalled();
  });

  it("secret corect → trimite digestul", async () => {
    const res = await GET(req("Bearer secret-de-test"));
    expect(res.status).toBe(200);
    expect(sendWeeklyDigests).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ ok: true, built: 3, sent: 3 });
  });
});
