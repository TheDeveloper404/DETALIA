import { describe, expect, it } from "vitest";

import { normalizeWebsite } from "./url";

describe("normalizeWebsite — SEC-03 allowlist la input (website profil)", () => {
  it("gol → null", () => {
    expect(normalizeWebsite("")).toEqual({ ok: true, value: null });
    expect(normalizeWebsite("   ")).toEqual({ ok: true, value: null });
    expect(normalizeWebsite(null)).toEqual({ ok: true, value: null });
  });

  it("fără schemă → prefixează https://", () => {
    const r = normalizeWebsite("exemplu.ro");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("https://exemplu.ro/");
  });

  it("acceptă http și https", () => {
    expect(normalizeWebsite("http://exemplu.ro").ok).toBe(true);
    expect(normalizeWebsite("https://exemplu.ro").ok).toBe(true);
  });

  it("blochează scheme periculoase (port invalid după prefixare → parse eșuat)", () => {
    expect(normalizeWebsite("javascript:alert(1)")).toEqual({ ok: false });
    expect(normalizeWebsite("data:text/html,x")).toEqual({ ok: false });
  });
});
