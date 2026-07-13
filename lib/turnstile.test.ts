import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `SECRET` se citește la nivel de modul din process.env → pentru fiecare scenariu (cu/fără secret)
// re-importăm modulul proaspăt (vi.resetModules) DUPĂ ce am setat env-ul, altfel toate testele ar vedea
// valoarea citită la primul import.
async function loadVerifyTurnstile() {
  vi.resetModules();
  const mod = await import("./turnstile");
  return mod.verifyTurnstile;
}

describe("verifyTurnstile", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe("fără TURNSTILE_SECRET_KEY (dev/local)", () => {
    beforeEach(() => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    });

    it("no-op → trece chiar și fără token (widget nerenderat local)", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      expect(await verifyTurnstile(null)).toBe(true);
    });
  });

  describe("cu TURNSTILE_SECRET_KEY, dar pe preview (VERCEL_ENV !== production)", () => {
    beforeEach(() => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubEnv("VERCEL_ENV", "preview");
    });

    it("no-op → trece chiar și fără token (domeniul *.vercel.app nu e în allowlist-ul Turnstile)", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      global.fetch = vi.fn();
      expect(await verifyTurnstile(null)).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("cu TURNSTILE_SECRET_KEY (producție)", () => {
    beforeEach(() => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubEnv("VERCEL_ENV", "production");
    });

    it("fără token → respins (suspect, nu ajunge la Cloudflare)", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      global.fetch = vi.fn();
      expect(await verifyTurnstile(null)).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("token valid (Cloudflare success:true) → acceptat", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
      expect(await verifyTurnstile("tok-valid")).toBe(true);
    });

    it("token invalid (Cloudflare success:false) → respins", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: false }) });
      expect(await verifyTurnstile("tok-invalid")).toBe(false);
    });

    it("Cloudflare indisponibil (fetch aruncă) → fail-open (nu blocăm signup-ul pe outage extern)", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
      expect(await verifyTurnstile("tok-oricare")).toBe(true);
    });

    it("trimite secret + response + remoteip la Cloudflare", async () => {
      const verifyTurnstile = await loadVerifyTurnstile();
      const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
      global.fetch = fetchMock;
      await verifyTurnstile("tok-x", "1.2.3.4");

      const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
      expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      const body = init.body as URLSearchParams;
      expect(body.get("secret")).toBe("test-secret");
      expect(body.get("response")).toBe("tok-x");
      expect(body.get("remoteip")).toBe("1.2.3.4");
    });
  });
});
