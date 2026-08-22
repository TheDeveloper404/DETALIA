import { describe, expect, it } from "vitest";

import { isPublicPath } from "./public-paths";

const PATHS = ["/", "/login", "/s", "/projects/join"];
const REQUIRES_SEGMENT = ["/projects/join", "/s"];

describe("isPublicPath — prefix public DOAR cu segment nevid după (SEC: /projects/join/ fără token)", () => {
  it("match exact pe path-uri normale", () => {
    expect(isPublicPath("/login", PATHS, REQUIRES_SEGMENT)).toBe(true);
    expect(isPublicPath("/", PATHS, REQUIRES_SEGMENT)).toBe(true);
  });

  it("prefix cu segment real după → public", () => {
    expect(isPublicPath("/projects/join/abc123token", PATHS, REQUIRES_SEGMENT)).toBe(true);
    expect(isPublicPath("/s/some-sketch-id", PATHS, REQUIRES_SEGMENT)).toBe(true);
  });

  it("SEC: prefix cu slash final FĂRĂ token (segment gol) → NU mai e public (bug găsit 2026-08-22, ZAP)", () => {
    expect(isPublicPath("/projects/join/", PATHS, REQUIRES_SEGMENT)).toBe(false);
  });

  it("SEC-05 (audit 2026-08-22): prefix FĂRĂ slash final, exact, pe un path din requiresSegment → NU e public", () => {
    expect(isPublicPath("/projects/join", PATHS, REQUIRES_SEGMENT)).toBe(false);
    expect(isPublicPath("/s", PATHS, REQUIRES_SEGMENT)).toBe(false);
  });

  it("fără al 3-lea argument (requiresSegment omis) → comportament vechi, match exact permis (regresie de compatibilitate)", () => {
    expect(isPublicPath("/login", PATHS)).toBe(true);
  });

  it("rută neînrudită → protejată", () => {
    expect(isPublicPath("/projects/some-id", PATHS, REQUIRES_SEGMENT)).toBe(false);
    expect(isPublicPath("/feed", PATHS, REQUIRES_SEGMENT)).toBe(false);
  });

  it("rădăcina „/” nu devine prefix universal", () => {
    expect(isPublicPath("/anything", PATHS, REQUIRES_SEGMENT)).toBe(false);
  });
});
