import type { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";

import { checkLimit, hashEmail, shouldCountView } from "./rate-limit";

// Fake minimal — shouldCountView apelează doar `.set(key, value, opts)`. Vezi comentariul de la
// fakeLimiter mai jos pentru de ce nu testăm cu Redis real.
function fakeRedis(impl: (...args: unknown[]) => Promise<unknown>): Redis {
  return { set: impl } as unknown as Redis;
}

// Fake minimal — checkLimit apelează doar `.limit(identifier)` pe obiectul primit. Un test cu Redis REAL
// ar necesita credențiale Upstash (nedisponibile la `npm test` local, vezi vitest.config.ts — fără
// încărcare de .env) și ar polua cotele reale; fake-ul verifică exact ramurile din checkLimit (succes/
// respins/eroare), nu comportamentul intern al @upstash/ratelimit (asta nu ne aparține).
function fakeLimiter(
  impl: () => Promise<{ success: boolean; reset: number }> | never,
): Ratelimit {
  return { limit: impl } as unknown as Ratelimit;
}

describe("hashEmail — PII (email) nu intră în Redis în clar", () => {
  it("nu întoarce emailul în clar și e SHA-256 (64 hex)", () => {
    const h = hashEmail("Test@Exemplu.ro");
    expect(h).not.toContain("@");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizează (trim + lowercase) → hash stabil", () => {
    expect(hashEmail("  USER@x.ro ")).toBe(hashEmail("user@x.ro"));
  });

  it("emailuri diferite → hash-uri diferite", () => {
    expect(hashEmail("a@x.ro")).not.toBe(hashEmail("b@x.ro"));
  });
});

describe("checkLimit — fail-open când limiterul e dezactivat (Redis neconfigurat)", () => {
  it("limiter null → lasă cererea să treacă", async () => {
    expect(await checkLimit(null, "orice")).toEqual({ ok: true });
  });
});

describe("checkLimit — limiter activ (cazurile netestate până acum: succes/respins/outage)", () => {
  it("sub cotă (res.success=true) → ok:true", async () => {
    const limiter = fakeLimiter(async () => ({ success: true, reset: Date.now() + 60_000 }));
    expect(await checkLimit(limiter, "user-1")).toEqual({ ok: true });
  });

  it("cotă depășită (res.success=false) → ok:false + retryAfterSec pozitiv, din res.reset", async () => {
    const reset = Date.now() + 5_000;
    const limiter = fakeLimiter(async () => ({ success: false, reset }));
    const result = await checkLimit(limiter, "user-1");
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(5);
  });

  it("reset deja trecut → retryAfterSec minim 1 (niciodată 0/negativ)", async () => {
    const limiter = fakeLimiter(async () => ({ success: false, reset: Date.now() - 1000 }));
    const result = await checkLimit(limiter, "user-1");
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBe(1);
  });

  it("outage Redis (limiter aruncă) → politica de mediu (non-producție = fail-open aici la teste)", async () => {
    const limiter = fakeLimiter(async () => {
      throw new Error("Redis unavailable");
    });
    // NODE_ENV la `npm test` nu e "production" → FAIL_OPEN=true (vezi rate-limit.ts) → nu blochează.
    expect(await checkLimit(limiter, "user-1")).toEqual({ ok: true });
  });
});

describe("shouldCountView — dedup vizualizări (SEC/2026-08-09)", () => {
  it("client null (Redis neconfigurat) → fail-open, numără oricum", async () => {
    expect(await shouldCountView("detail-1:user-1", null)).toBe(true);
  });

  it("SET NX reușește (cheia nu exista) → primă vizualizare din fereastră, numără", async () => {
    const client = fakeRedis(async () => "OK");
    expect(await shouldCountView("detail-1:user-1", client)).toBe(true);
  });

  it("SET NX eșuează (cheia exista deja, întoarce null) → vizualizare duplicată, NU numără", async () => {
    const client = fakeRedis(async () => null);
    expect(await shouldCountView("detail-1:user-1", client)).toBe(false);
  });

  it("cheia include exact detailId:userId — chei diferite pentru useri diferiți pe același detaliu", async () => {
    const setSpy = vi.fn(async (..._args: unknown[]) => "OK");
    const client = fakeRedis(setSpy);

    await shouldCountView("detail-1:user-1", client);
    await shouldCountView("detail-1:user-2", client);

    const [keyA] = setSpy.mock.calls[0]!;
    const [keyB] = setSpy.mock.calls[1]!;
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("detail-1:user-1");
    expect(keyB).toContain("detail-1:user-2");
  });

  it("outage Redis (set aruncă) → fail-open, numără oricum", async () => {
    const client = fakeRedis(async () => {
      throw new Error("Redis unavailable");
    });
    expect(await shouldCountView("detail-1:user-1", client)).toBe(true);
  });
});
