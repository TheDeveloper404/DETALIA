import { describe, expect, it } from "vitest";

import { getTourSteps, TOUR_STEPS } from "./product-tour";

// Selectorii `data-tour` real prezenți în DOM-ul paginii /feed (header + sidebar + FAB + primul card).
// Vezi app-header.tsx, feed-sidebar.tsx, add-detail-fab.tsx, user-menu.tsx, detail-card.tsx.
// „Proiecte" scos din tur 2026-08-26; „Conținutul tău" (my-content) + „primul card" (feed-first-card)
// adăugate 2026-08-27.
const REAL_TOUR_TARGETS = ["categories", "profile", "my-content", "feed-first-card", "add", "menu"];

function targetsOf(steps: typeof TOUR_STEPS): string[] {
  return steps.map((step) => {
    const match = /^\[data-tour="(.+)"\]$/.exec(String(step.element));
    if (!match) throw new Error(`Selector neașteptat: ${step.element}`);
    return match[1];
  });
}

describe("TOUR_STEPS", () => {
  it("țintește exact selectorii reali din markup, fără duplicate", () => {
    const targets = targetsOf(TOUR_STEPS);

    expect(new Set(targets)).toEqual(new Set(REAL_TOUR_TARGETS));
    expect(targets).toHaveLength(REAL_TOUR_TARGETS.length);
  });

  it("fiecare pas are titlu și descriere populate", () => {
    for (const step of TOUR_STEPS) {
      expect(step.popover?.title?.trim()).toBeTruthy();
      expect(step.popover?.description?.trim()).toBeTruthy();
    }
  });
});

describe("getTourSteps", () => {
  it("desktop cu feed populat → toți pașii", () => {
    const targets = targetsOf(getTourSteps({ isDesktop: true, hasFeedItems: true }));
    expect(targets).toEqual(REAL_TOUR_TARGETS);
  });

  it("non-desktop → sare pasul din sidebar (my-content), restul intact", () => {
    const targets = targetsOf(getTourSteps({ isDesktop: false, hasFeedItems: true }));
    expect(targets).not.toContain("my-content");
    expect(targets).toContain("feed-first-card");
    expect(targets).toEqual(REAL_TOUR_TARGETS.filter((t) => t !== "my-content"));
  });

  it("feed gol → sare pasul de card (feed-first-card), restul intact", () => {
    const targets = targetsOf(getTourSteps({ isDesktop: true, hasFeedItems: false }));
    expect(targets).not.toContain("feed-first-card");
    expect(targets).toContain("my-content");
    expect(targets).toEqual(REAL_TOUR_TARGETS.filter((t) => t !== "feed-first-card"));
  });

  it("non-desktop + feed gol → sare ambii pași condiționați", () => {
    const targets = targetsOf(getTourSteps({ isDesktop: false, hasFeedItems: false }));
    expect(targets).toEqual(REAL_TOUR_TARGETS.filter((t) => t !== "my-content" && t !== "feed-first-card"));
  });
});
