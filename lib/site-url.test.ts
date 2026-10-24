import { afterEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "./site-url";

describe("siteUrl — originea publică a site-ului", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("folosește AUTH_URL când e setat", () => {
    vi.stubEnv("AUTH_URL", "https://detalia.ro");
    expect(siteUrl()).toBe("https://detalia.ro");
  });

  it("taie slash-ul final (altfel `${siteUrl()}/ghid` ar da `//ghid`)", () => {
    vi.stubEnv("AUTH_URL", "https://detalia.ro/");
    expect(siteUrl()).toBe("https://detalia.ro");
  });

  it("AUTH_URL gol → fallback localhost, nu string gol (new URL('') ar arunca în layout)", () => {
    vi.stubEnv("AUTH_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("AUTH_URL invalid (fără schemă) → fallback localhost, nu URL invalid", () => {
    vi.stubEnv("AUTH_URL", "detalia.ro");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("AUTH_URL nesetat → fallback localhost", () => {
    vi.stubEnv("AUTH_URL", undefined);
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
