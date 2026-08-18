import { describe, expect, it } from "vitest";

import { DETAIL_TOUR_STEPS } from "./detail-tour-steps";

// Selectorii `data-tour` real prezenți în DOM-ul paginii /details/[id] — vezi detail-workspace.tsx.
const REAL_TOUR_TARGETS = ["detail-tabs", "detail-actions", "detail-validation", "detail-comments"];

describe("DETAIL_TOUR_STEPS", () => {
  it("țintește exact selectorii reali din markup, fără duplicate", () => {
    const selectors = DETAIL_TOUR_STEPS.map((step) => step.element);
    const targets = selectors.map((sel) => {
      const match = /^\[data-tour="(.+)"\]$/.exec(String(sel));
      if (!match) throw new Error(`Selector neașteptat: ${sel}`);
      return match[1];
    });

    expect(new Set(targets)).toEqual(new Set(REAL_TOUR_TARGETS));
    expect(targets).toHaveLength(REAL_TOUR_TARGETS.length);
  });

  it("fiecare pas are titlu și descriere populate", () => {
    for (const step of DETAIL_TOUR_STEPS) {
      expect(step.popover?.title?.trim()).toBeTruthy();
      expect(step.popover?.description?.trim()).toBeTruthy();
    }
  });
});
