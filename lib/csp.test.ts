import { describe, expect, it } from "vitest";

import { buildCspHeader } from "./csp";

describe("buildCspHeader", () => {
  it("preview: include originile toolbar-ului Vercel (vercel.live/pusher)", () => {
    const csp = buildCspHeader("abc", false, true);
    expect(csp).toContain("https://vercel.live");
    expect(csp).toContain("pusher.com");
  });

  it("producție: NU include vercel.live/pusher (toolbar preview), dar păstrează storage + Turnstile", () => {
    const csp = buildCspHeader("abc", false, false);
    expect(csp).not.toContain("vercel.live");
    expect(csp).not.toContain("pusher.com");
    // Funcțional real — trebuie să rămână MEREU:
    expect(csp).toContain("https://*.public.blob.vercel-storage.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
  });

  it("connect-src include MEREU vercel.com (API real de Vercel Blob, nu doar toolbar preview)", () => {
    const prod = buildCspHeader("abc", false, false);
    const preview = buildCspHeader("abc", false, true);
    for (const csp of [prod, preview]) {
      const connectSrc = csp.split(";").find((d) => d.trim().startsWith("connect-src")) ?? "";
      expect(connectSrc).toContain("https://vercel.com");
    }
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
