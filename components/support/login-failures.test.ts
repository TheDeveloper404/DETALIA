import { describe, expect, it } from "vitest";

import { parseStoredFailures, recentFailures, recordVerificationFailure } from "./login-failures";

const HOUR = 60 * 60 * 1000;
const now = 1_800_000_000_000;

describe("recordVerificationFailure", () => {
  // Regula (plan aprobat): „de la al 2-lea link esuat (in ultimele 24h)" → caseta WhatsApp.
  it("adaugă eșecul nou și uită ce e mai vechi de 24h", () => {
    expect(recordVerificationFailure([now - 25 * HOUR, now - HOUR], now)).toEqual([now - HOUR, now]);
  });

  it("ignoră același eșec înregistrat de două ori în 2 secunde (StrictMode)", () => {
    expect(recordVerificationFailure([now - 500], now)).toEqual([now - 500]);
  });

  it("numără doar eșecurile recente", () => {
    expect(recentFailures([now - 30 * HOUR, now - 2 * HOUR, now - HOUR], now)).toHaveLength(2);
  });
});

describe("parseStoredFailures", () => {
  it("tolerează valori lipsă sau corupte din localStorage", () => {
    expect(parseStoredFailures(null)).toEqual([]);
    expect(parseStoredFailures("{nu e json")).toEqual([]);
    expect(parseStoredFailures('{"a":1}')).toEqual([]);
    expect(parseStoredFailures('[1, "x", 2]')).toEqual([1, 2]);
  });
});
