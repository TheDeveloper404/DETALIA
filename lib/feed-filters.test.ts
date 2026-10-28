import { describe, expect, it } from "vitest";

import { clearFeedFilters, feedFilterChips } from "./feed-filters";

describe("feedFilterChips", () => {
  it("un chip per filtru activ, rolul si judetul cu eticheta lor", () => {
    const chips = feedFilterChips(
      new URLSearchParams("following=1&unanswered=1&role=PROIECTANT&judet=Cluj"),
    );
    expect(chips).toEqual([
      { key: "following", label: "Doar ce urmăresc" },
      { key: "unanswered", label: "Așteaptă ajutor" },
      { key: "role", label: "Rol: Proiectare" },
      { key: "judet", label: "Județ: Cluj" },
    ]);
  });

  it("valorile invalide, filtrele scoase si parametrii care nu sunt filtre nu dau chip-uri", () => {
    expect(
      feedFilterChips(
        new URLSearchParams("following=0&role=__proto__&judet=Atlantida&verified=1&sketches=1&q=x&cat=c"),
      ),
    ).toEqual([]);
  });
});

describe("clearFeedFilters", () => {
  it("scoate filtrele si pagina, pastreaza cautarea si categoria", () => {
    const next = clearFeedFilters(
      new URLSearchParams("q=grinda&cat=c1&page=3&following=1&role=EXECUTANT&judet=Iași"),
    );
    expect(next.toString()).toBe("q=grinda&cat=c1");
  });
});
