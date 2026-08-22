import { describe, expect, it } from "vitest";

import { computeAnnouncementDelayMs, NEW_USER_ANNOUNCEMENT_DELAY_MS } from "./announcement-delay";

describe("computeAnnouncementDelayMs — „Ce e nou” nu se suprapune peste turul vizual la useri noi", () => {
  it("user nou (tur activ) → întârziat", () => {
    expect(computeAnnouncementDelayMs(true)).toBe(NEW_USER_ANNOUNCEMENT_DELAY_MS);
    expect(computeAnnouncementDelayMs(true)).toBeGreaterThan(0);
  });

  it("user existent (fără tur) → imediat, ca înainte", () => {
    expect(computeAnnouncementDelayMs(false)).toBe(0);
  });
});
