import { describe, expect, it } from "vitest";

import { resolveMagicLinkBaseUrl } from "./magic-link-url";

describe("resolveMagicLinkBaseUrl — link din email magic-link folosește host-ul request-ului curent, cu allowlist", () => {
  it("acceptă un deployment de preview real (hash), scope-ul echipei noastre", () => {
    const req = new Request("https://ignored.example.com", {
      headers: { "x-forwarded-host": "detalia-abc123-livius-projects-1af30dca.vercel.app" },
    });
    expect(resolveMagicLinkBaseUrl(req)).toBe("https://detalia-abc123-livius-projects-1af30dca.vercel.app");
  });

  it("acceptă alias-ul stabil de branch (detalia-git-dev-...), scope-ul echipei noastre", () => {
    const req = new Request("https://x", {
      headers: { host: "detalia-git-dev-livius-projects-1af30dca.vercel.app" },
    });
    expect(resolveMagicLinkBaseUrl(req)).toBe("https://detalia-git-dev-livius-projects-1af30dca.vercel.app");
  });

  it("acceptă domeniul de producție detalia.ro pe header-ul host simplu", () => {
    const req = new Request("https://ignored.example.com", {
      headers: { host: "detalia.ro" },
    });
    expect(resolveMagicLinkBaseUrl(req)).toBe("https://detalia.ro");
  });

  it("SEC: respinge un Host/X-Forwarded-Host arbitrar (nu-l folosește, nu scurge tokenul spre alt domeniu)", () => {
    const req = new Request("https://ignored.example.com", {
      headers: { "x-forwarded-host": "evil.com" },
    });
    expect(resolveMagicLinkBaseUrl(req)).not.toBe("https://evil.com");
    expect(resolveMagicLinkBaseUrl(req)).toBe(process.env.AUTH_URL ?? "http://localhost:3000");
  });

  it("SEC: respinge un subdomeniu vercel.app care NU aparține proiectului detalia", () => {
    const req = new Request("https://ignored.example.com", {
      headers: { "x-forwarded-host": "alt-proiect-xyz.vercel.app" },
    });
    expect(resolveMagicLinkBaseUrl(req)).toBe(process.env.AUTH_URL ?? "http://localhost:3000");
  });

  it("SEC-01 (audit 2026-08-22): respinge un proiect Vercel AL ALTCUIVA cu prefix „detalia-”, doar din namespace-ul global vercel.app — namespace-ul nu e al nostru, doar sufixul de scope al echipei e", () => {
    const req = new Request("https://x", {
      headers: { "x-forwarded-host": "detalia-auth.vercel.app" },
    });
    expect(resolveMagicLinkBaseUrl(req)).not.toBe("https://detalia-auth.vercel.app");
    expect(resolveMagicLinkBaseUrl(req)).toBe(process.env.AUTH_URL ?? "http://localhost:3000");
  });

  it("SEC-08: protocolul e mereu https pe un host din allowlist, indiferent ce trimite x-forwarded-proto", () => {
    const req = new Request("https://x", {
      headers: {
        "x-forwarded-host": "detalia-abc123-livius-projects-1af30dca.vercel.app",
        "x-forwarded-proto": "http",
      },
    });
    expect(resolveMagicLinkBaseUrl(req)).toBe("https://detalia-abc123-livius-projects-1af30dca.vercel.app");
  });

  it("nu se ancorează niciodată la un alt environment — fiecare host valid din allowlist se rezolvă la el însuși", () => {
    const previewReq = new Request("https://x", {
      headers: { host: "detalia-git-dev-livius-projects-1af30dca.vercel.app" },
    });
    const prodReq = new Request("https://x", { headers: { host: "detalia.ro" } });
    expect(resolveMagicLinkBaseUrl(previewReq)).toBe("https://detalia-git-dev-livius-projects-1af30dca.vercel.app");
    expect(resolveMagicLinkBaseUrl(prodReq)).toBe("https://detalia.ro");
  });

  it("fără niciun header de host → fallback AUTH_URL sau localhost (nu crapă)", () => {
    const req = new Request("https://ignored.example.com");
    expect(resolveMagicLinkBaseUrl(req)).toBe(process.env.AUTH_URL ?? "http://localhost:3000");
  });
});
