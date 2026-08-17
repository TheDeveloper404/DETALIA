import { describe, expect, it } from "vitest";

import { TOUR_STEPS } from "./product-tour";

// Selectorii `data-tour` real prezenți în DOM-ul paginii /feed (header + sidebar + FAB) — vezi
// app-header.tsx, feed-sidebar.tsx, add-detail-fab.tsx, user-menu.tsx.
const REAL_TOUR_TARGETS = ["categories", "profile", "add", "projects", "menu"];

describe("TOUR_STEPS", () => {
  it("țintește exact selectorii reali din markup, fără duplicate", () => {
    const selectors = TOUR_STEPS.map((step) => step.element);
    const targets = selectors.map((sel) => {
      const match = /^\[data-tour="(.+)"\]$/.exec(String(sel));
      if (!match) throw new Error(`Selector neașteptat: ${sel}`);
      return match[1];
    });

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
