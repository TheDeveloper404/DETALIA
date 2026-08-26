import { describe, expect, it } from "vitest";

import { computeBadges, diffNewBadges, snapshotBadges } from "./badges";

const ZERO = {
  published: 0,
  sketches: 0,
  validationsGiven: 0,
  validationsReceived: 0,
  activeDaysLastYear: 0,
  referralsCount: 0,
  combinedContribution: 0,
  activityVolume: 0,
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
    const badges = computeBadges({ ...ZERO, published: 1 });
    expect(badges).toEqual([
      { id: "contributor", label: "Contribuitor", description: "Detalii de execuție publicate", tier: "bronze" },
    ]);
  });

  it("toate metricile la maxim → toate cele 8 badge-uri, treapta aur", () => {
    const badges = computeBadges({
      published: 25,
      sketches: 25,
      validationsGiven: 75,
      validationsReceived: 75,
      activeDaysLastYear: 250,
      referralsCount: 10,
      combinedContribution: 15,
      activityVolume: 200,
    });
    expect(badges).toHaveLength(8);
    expect(badges.every((b) => b.tier === "gold")).toBe(true);
  });

  it("badge single „Creștem împreună” — sub prag → nimic, la prag → direct gold (fără trepte intermediare)", () => {
    expect(computeBadges({ ...ZERO, referralsCount: 9 }).find((b) => b.id === "growth")).toBeUndefined();
    expect(computeBadges({ ...ZERO, referralsCount: 10 }).find((b) => b.id === "growth")?.tier).toBe("gold");
  });

  it("„Polivalent” (versatile) — sub prag → nimic, la prag → treapta corectă pe fiecare tier", () => {
    expect(computeBadges({ ...ZERO, combinedContribution: 0 }).find((b) => b.id === "versatile")).toBeUndefined();
    expect(computeBadges({ ...ZERO, combinedContribution: 1 }).find((b) => b.id === "versatile")?.tier).toBe("bronze");
    expect(computeBadges({ ...ZERO, combinedContribution: 5 }).find((b) => b.id === "versatile")?.tier).toBe("silver");
    expect(computeBadges({ ...ZERO, combinedContribution: 15 }).find((b) => b.id === "versatile")?.tier).toBe("gold");
  });

  it("„Motor al comunității” (powerhouse) — praguri tiered normale", () => {
    expect(computeBadges({ ...ZERO, activityVolume: 19 }).find((b) => b.id === "powerhouse")).toBeUndefined();
    expect(computeBadges({ ...ZERO, activityVolume: 20 }).find((b) => b.id === "powerhouse")?.tier).toBe("bronze");
    expect(computeBadges({ ...ZERO, activityVolume: 75 }).find((b) => b.id === "powerhouse")?.tier).toBe("silver");
    expect(computeBadges({ ...ZERO, activityVolume: 200 }).find((b) => b.id === "powerhouse")?.tier).toBe("gold");
  });

});

describe("diffNewBadges — pop-up „badge nou” (2026-08-17)", () => {
  const contributorBronze = { id: "contributor" as const, label: "Contribuitor", description: "d", tier: "bronze" as const };
  const contributorSilver = { id: "contributor" as const, label: "Contribuitor", description: "d", tier: "silver" as const };
  const validatorBronze = { id: "validator" as const, label: "Validator", description: "d", tier: "bronze" as const };

  it("fără snapshot văzut → toate badge-urile curente sunt „noi”", () => {
    expect(diffNewBadges([contributorBronze], {})).toEqual([contributorBronze]);
  });

  it("badge deja văzut la ACELAȘI tier → nu mai e „nou”", () => {
    expect(diffNewBadges([contributorBronze], { contributor: "bronze" })).toEqual([]);
  });

  it("badge URCAT de tier față de snapshot → e „nou” (celebrăm upgrade-ul)", () => {
    expect(diffNewBadges([contributorSilver], { contributor: "bronze" })).toEqual([contributorSilver]);
  });

  it("badge la un tier MAI MIC decât snapshot-ul (nu poate scădea în practică, dar defensiv) → nu e nou", () => {
    expect(diffNewBadges([contributorBronze], { contributor: "silver" })).toEqual([]);
  });

  it("un badge nou apărut alături de unul deja văzut → doar cel nou e raportat", () => {
    expect(diffNewBadges([contributorBronze, validatorBronze], { contributor: "bronze" })).toEqual([validatorBronze]);
  });
});

describe("snapshotBadges", () => {
  it("transformă lista de badge-uri câștigate în Record id→tier", () => {
    const badges = computeBadges({ ...ZERO, published: 1, validationsGiven: 5 });
    expect(snapshotBadges(badges)).toEqual({ contributor: "bronze", validator: "bronze" });
  });

  it("fără badge-uri → snapshot gol", () => {
    expect(snapshotBadges([])).toEqual({});
  });
});
