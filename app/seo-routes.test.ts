import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import manifest from "./manifest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("rute SEO (robots / sitemap / manifest)", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "https://detalia.ro/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("robots: anunță sitemap-ul absolut și păstrează zonele private blocate", () => {
    const r = robots();
    expect(r.sitemap).toBe("https://detalia.ro/sitemap.xml");
    expect(r.rules).toMatchObject({
      allow: "/",
      disallow: ["/admin-page/", "/api/", "/verify", "/projects/join/"],
    });
  });

  it("sitemap: doar paginile publice de conținut, URL-uri absolute fără slash dublu", () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      "https://detalia.ro",
      "https://detalia.ro/ghid",
      "https://detalia.ro/signup",
      "https://detalia.ro/termeni",
      "https://detalia.ro/confidentialitate",
    ]);
  });

  it("manifest: pornește din landing și include iconița PNG pentru iOS", () => {
    const m = manifest();
    expect(m.start_url).toBe("/");
    expect(m.icons?.map((i) => i.src)).toEqual(expect.arrayContaining(["/icon.svg", "/apple-icon", "/pwa-192.png", "/pwa-512.png"]));
  });
});
