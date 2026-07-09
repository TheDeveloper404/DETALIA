import { describe, expect, it } from "vitest";

import { buildCspHeader } from "./csp";

describe("buildCspHeader", () => {
  it("preview: include originile toolbar-ului Vercel (vercel.live/pusher)", () => {
    const csp = buildCspHeader("abc", false, true);
    expect(csp).toContain("https://vercel.live");
    expect(csp).toContain("pusher.com");
  });

  it("producție: NU include vercel.live/vercel.com/pusher, dar păstrează storage + Turnstile", () => {
    const csp = buildCspHeader("abc", false, false);
    expect(csp).not.toContain("vercel.live");
    expect(csp).not.toContain("vercel.com");
    expect(csp).not.toContain("pusher.com");
    // Funcțional real — trebuie să rămână MEREU:
    expect(csp).toContain("https://*.public.blob.vercel-storage.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
  });

  it("nonce-ul e mereu în script-src; unsafe-inline NU e în script-src", () => {
    const csp = buildCspHeader("xyz", false, false);
    expect(csp).toContain("'nonce-xyz'");
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("dev: adaugă 'unsafe-eval' (HMR) în script-src", () => {
    const csp = buildCspHeader("xyz", true, true);
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).toContain("'unsafe-eval'");
  });
});
