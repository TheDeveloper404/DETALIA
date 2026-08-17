import { describe, expect, it } from "vitest";

import { computeBadges } from "./badges";

const ZERO = {
  published: 0,
  sketches: 0,
  validationsGiven: 0,
  validationsReceived: 0,
  activeDaysLastYear: 0,
};

describe("computeBadges", () => {
  it("fără nicio activitate → niciun badge", () => {
    expect(computeBadges(ZERO)).toEqual([]);
  });

  it("sub pragul de bronz → badge-ul respectiv nu apare", () => {
    const badges = computeBadges({ ...ZERO, published: 0 });
    expect(badges.find((b) => b.id === "contributor")).toBeUndefined();
  });

  it("exact la pragul de bronz → treapta bronz", () => {
    const badges = computeBadges({ ...ZERO, published: 1 });
    expect(badges.find((b) => b.id === "contributor")?.tier).toBe("bronze");
  });

  it("între praguri → treapta cea mai mare atinsă, nu următoarea", () => {
    const badges = computeBadges({ ...ZERO, published: 9 });
    expect(badges.find((b) => b.id === "contributor")?.tier).toBe("bronze");
  });

  it("exact la pragul de argint → treapta argint", () => {
    const badges = computeBadges({ ...ZERO, published: 10 });
    expect(badges.find((b) => b.id === "contributor")?.tier).toBe("silver");
  });

  it("peste pragul de aur → treapta aur (fără treaptă a 4-a)", () => {
    const badges = computeBadges({ ...ZERO, published: 1000 });
    expect(badges.find((b) => b.id === "contributor")?.tier).toBe("gold");
  });

  it("fiecare metrică alimentează DOAR badge-ul ei, nu se amestecă", () => {
    const badges = computeBadges({
      published: 1,
      sketches: 0,
      validationsGiven: 0,
      validationsReceived: 0,
      activeDaysLastYear: 0,
    });
    expect(badges).toEqual([
      { id: "contributor", label: "Contribuitor", description: "Detalii de execuție publicate", tier: "bronze" },
    ]);
  });

  it("toate metricile la maxim → toate cele 5 badge-uri, treapta aur", () => {
    const badges = computeBadges({
      published: 25,
      sketches: 25,
      validationsGiven: 75,
      validationsReceived: 75,
      activeDaysLastYear: 250,
    });
    expect(badges).toHaveLength(5);
    expect(badges.every((b) => b.tier === "gold")).toBe(true);
  });
});
