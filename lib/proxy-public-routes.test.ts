import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Proxy-ul (poarta de sesiune) rulează ÎNAINTEA handler-elor. Testele handler-elor de cron/dezabonare
// îi apelează direct, deci nu pot prinde un redirect la /login pus de proxy (AUD-06: digestul de luni
// primea 302 în producție; AUD-07: linkul de dezabonare din email cerea login). Aici exersăm proxy-ul
// real, cu DB și sesiunea mock-uite.

const { getToken, getSettingsRow } = vi.hoisted(() => {
  // Fără cache pe setări — fiecare test își alege starea de lockdown.
  process.env.SETTINGS_CACHE_TTL_MS = "0";
  return { getToken: vi.fn(), getSettingsRow: vi.fn() };
});

vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("@/server/repos/settingsRepo", () => ({ getSettingsRow }));
vi.mock("@/server/repos/adminsRepo", () => ({
  getValidAdminPendingSession: vi.fn(),
  getValidAdminSessionEmail: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getUserGateInfo: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import proxy from "@/proxy";

const BASE = "https://detalia.ro";

function isRedirect(res: Response): boolean {
  return res.status >= 300 && res.status < 400;
}

const vercelCrons: { path: string }[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
).crons;

describe("proxy — rute fără sesiune de user", () => {
  beforeEach(() => {
    getToken.mockResolvedValue(null);
    getSettingsRow.mockResolvedValue({ lockdownEnabled: false });
  });

  it("control: o rută protejată fără sesiune e redirectată la /login", async () => {
    const res = await proxy(new NextRequest(`${BASE}/feed`));
    expect(isRedirect(res)).toBe(true);
    expect(res.headers.get("location")).toContain("/login");
  });

  it.each(vercelCrons.map((c) => c.path))(
    "cronul %s din vercel.json ajunge la handler fără sesiune",
    async (path) => {
      const res = await proxy(
        new NextRequest(`${BASE}${path}`, { headers: { authorization: "Bearer x" } }),
      );
      expect(isRedirect(res)).toBe(false);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it.each(vercelCrons.map((c) => c.path))(
    "cronul %s nu e rescris la /maintenance în lockdown",
    async (path) => {
      getSettingsRow.mockResolvedValue({ lockdownEnabled: true });
      const res = await proxy(new NextRequest(`${BASE}${path}`));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("linkul de dezabonare din email (GET cu token) ajunge la handler fără sesiune", async () => {
    const res = await proxy(new NextRequest(`${BASE}/api/digest/unsubscribe?token=abc`));
    expect(isRedirect(res)).toBe(false);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("confirmarea dezabonării (POST) ajunge la handler fără sesiune", async () => {
    const res = await proxy(new NextRequest(`${BASE}/api/digest/unsubscribe`, { method: "POST" }));
    expect(isRedirect(res)).toBe(false);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("ghidul de utilizare e accesibil fără sesiune (linkuit din landing)", async () => {
    const res = await proxy(new NextRequest(`${BASE}/ghid`));
    expect(isRedirect(res)).toBe(false);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("prefixul /api/cron NU e public în bloc — o rută cron nelistată rămâne protejată", async () => {
    const res = await proxy(new NextRequest(`${BASE}/api/cron/altceva`));
    expect(isRedirect(res)).toBe(true);
  });
});
