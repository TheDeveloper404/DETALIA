import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_MAX_AGE_SECONDS } from "./session-config";

async function loadTtl(raw: string | undefined): Promise<number> {
  vi.resetModules();
  vi.stubEnv("MAGIC_LINK_TTL_MINUTES", raw);
  return (await import("./session-config")).magicLinkTtlMinutes;
}

describe("magicLinkTtlMinutes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("foloseste valoarea din env", async () => {
    expect(await loadTtl("30")).toBe(30);
  });

  it("revine la 15 cand env lipseste, e gol sau invalid", async () => {
    expect(await loadTtl(undefined)).toBe(15);
    expect(await loadTtl("")).toBe(15);
    expect(await loadTtl("abc")).toBe(15);
  });
});

// Gard de regresie pe decizia de produs 2026-08-09: sesiune FIXĂ de 7 zile de la ultimul login, nu
// culisantă. O revenire tăcută la default-ul Auth.js (30 zile) sau la o fereastră culisantă (prin
// re-rotirea `exp`) ar trece neobservată fără asta — nu există alt test care să prindă schimbarea
// valorii. Vezi `lib/auth.ts` (consumatorul) și `e2e/auth.setup.ts` (mint-uiește token cu aceeași
// valoare).
describe("SESSION_MAX_AGE_SECONDS", () => {
  it("e fix la 7 zile", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(SESSION_MAX_AGE_SECONDS).toBe(604_800);
  });
});
