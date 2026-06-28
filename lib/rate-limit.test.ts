import { describe, expect, it } from "vitest";

import { checkLimit, hashEmail } from "./rate-limit";

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
