import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ruta e publică în proxy (AUD-07) — dovada rămâne tokenul HMAC. GET doar confirmă, POST dezabonează.

const { setWeeklyDigestEnabled } = vi.hoisted(() => ({ setWeeklyDigestEnabled: vi.fn() }));

vi.mock("@/server/repos/usersRepo", () => ({ setWeeklyDigestEnabled }));
vi.mock("@/server/services/digestService", () => ({ DIGEST_UNSUBSCRIBE_PURPOSE: "digest-unsubscribe" }));

import { createSignedToken } from "@/lib/signed-token";

import { GET, POST } from "./route";

const URL_BASE = "https://detalia.ro/api/digest/unsubscribe";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function post(token: string): Request {
  const body = new FormData();
  body.set("token", token);
  return new Request(URL_BASE, { method: "POST", body });
}

describe("/api/digest/unsubscribe", () => {
  beforeAll(() => {
    // Cheie de test generată local, nu un secret real — `signed-token` derivă din `AUTH_SECRET`.
    process.env.AUTH_SECRET = randomBytes(24).toString("hex");
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  beforeEach(() => {
    setWeeklyDigestEnabled.mockReset();
    vi.useRealTimers();
  });

  it("GET cu token valid → pagină de confirmare, NU dezabonează", async () => {
    const token = createSignedToken("digest-unsubscribe", USER_ID);
    const res = await GET(new Request(`${URL_BASE}?token=${encodeURIComponent(token)}`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Dezabonează-mă");
    expect(setWeeklyDigestEnabled).not.toHaveBeenCalled();
  });

  it("GET cu token invalid → 400", async () => {
    const res = await GET(new Request(`${URL_BASE}?token=nu.e.valid`));
    expect(res.status).toBe(400);
  });

  it("POST cu token valid → dezabonează userul din token", async () => {
    const res = await POST(post(createSignedToken("digest-unsubscribe", USER_ID)));
    expect(res.status).toBe(200);
    expect(setWeeklyDigestEnabled).toHaveBeenCalledWith(USER_ID, false);
  });

  it("POST cu token invalid → 400, fără scriere", async () => {
    const res = await POST(post("nu.e.valid"));
    expect(res.status).toBe(400);
    expect(setWeeklyDigestEnabled).not.toHaveBeenCalled();
  });

  it("POST cu token pentru alt scop → 400, fără scriere", async () => {
    const res = await POST(post(createSignedToken("alt-scop", USER_ID)));
    expect(res.status).toBe(400);
    expect(setWeeklyDigestEnabled).not.toHaveBeenCalled();
  });

  it("POST cu token expirat (peste 60 de zile) → 400, fără scriere", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSignedToken("digest-unsubscribe", USER_ID);
    vi.setSystemTime(new Date("2026-03-15T00:00:00Z"));
    const res = await POST(post(token));
    expect(res.status).toBe(400);
    expect(setWeeklyDigestEnabled).not.toHaveBeenCalled();
  });
});
