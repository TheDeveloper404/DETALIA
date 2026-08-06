import { describe, expect, it } from "vitest";

import { formatPublishedRelative } from "./format";

const NOW = new Date("2026-08-06T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatPublishedRelative", () => {
  it("sub un minut → Publicat acum", () => {
    expect(formatPublishedRelative(ago(0), NOW)).toBe("Publicat acum");
    expect(formatPublishedRelative(ago(59 * SEC), NOW)).toBe("Publicat acum");
  });

  it("timestamp în viitor (ceas desincronizat) → Publicat acum, nu valoare negativă", () => {
    expect(formatPublishedRelative(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe("Publicat acum");
  });

  it("minute, cu singular/plural corect", () => {
    expect(formatPublishedRelative(ago(MIN), NOW)).toBe("acum 1 minut");
    expect(formatPublishedRelative(ago(5 * MIN), NOW)).toBe("acum 5 minute");
  });

  it("ore, cu singular/plural corect", () => {
    expect(formatPublishedRelative(ago(HOUR), NOW)).toBe("acum 1 oră");
    expect(formatPublishedRelative(ago(3 * HOUR), NOW)).toBe("acum 3 ore");
  });

  it("zile, cu singular/plural corect", () => {
    expect(formatPublishedRelative(ago(DAY), NOW)).toBe("acum 1 zi");
    expect(formatPublishedRelative(ago(3 * DAY), NOW)).toBe("acum 3 zile");
  });

  it("pragul cerut: la 7 zile încă e relativ, peste 7 zile trece pe dată exactă", () => {
    expect(formatPublishedRelative(ago(7 * DAY), NOW)).toBe("acum 7 zile");
    expect(formatPublishedRelative(ago(8 * DAY), NOW)).toMatch(/2026/);
  });

  it("data exactă e formatată în română, fus fix (nu depinde de mediul de execuție)", () => {
    expect(formatPublishedRelative(new Date("2026-06-18T09:00:00Z").toISOString(), NOW)).toBe(
      "18 iun. 2026",
    );
  });
});
