import { describe, expect, it } from "vitest";

import { buildFeedSearchUrl } from "./feed-search";

describe("buildFeedSearchUrl — sincronizare `q` în URL, fără reload, cu păstrarea celorlalți parametri", () => {
  it("q nou pe URL fără parametri existenți", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams(), "beton")).toBe("/feed?q=beton");
  });

  it("păstrează parametrii existenți (ex. `cat`) și adaugă `q`", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams("cat=structura"), "beton")).toBe(
      "/feed?cat=structura&q=beton",
    );
  });

  it("suprascrie un `q` existent, nu îl duplică", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams("q=vechi"), "nou")).toBe("/feed?q=nou");
  });

  it("q gol/doar spații → elimină parametrul `q` din URL", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams("cat=structura&q=beton"), "   ")).toBe(
      "/feed?cat=structura",
    );
  });

  it("fără niciun parametru rămas → path curat, fără `?`", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams("q=beton"), "")).toBe("/feed");
  });

  it("trimming pe spații de la capete înainte de a seta `q`", () => {
    expect(buildFeedSearchUrl("/feed", new URLSearchParams(), "  beton  ")).toBe("/feed?q=beton");
  });
});
