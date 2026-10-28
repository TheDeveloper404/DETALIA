import { describe, expect, it } from "vitest";

import { summarizeLogin } from "./health.lib";

describe("summarizeLogin", () => {
  it("separa scanerele de userii reali si clasifica rezultatul fiecarei sesiuni", () => {
    expect(
      summarizeLogin([
        { country: "US", failViews: 1, appViews: 0 },
        { country: "BR", failViews: 1, appViews: 0 },
        { country: "RO", failViews: 0, appViews: 3 },
        { country: "RO", failViews: 2, appViews: 1 },
        { country: "RO", failViews: 1, appViews: 0 },
        { country: "RO", failViews: 0, appViews: 0 },
      ]),
    ).toEqual({ scanners: 2, ok: 1, recovered: 1, blocked: 1, noOutcome: 1 });
  });

  it("un user din afara RO care intra in aplicatie nu e numarat ca scaner", () => {
    expect(summarizeLogin([{ country: "DE", failViews: 0, appViews: 2 }])).toMatchObject({ scanners: 0, ok: 1 });
  });
});
