import { describe, expect, it } from "vitest";

import { SESSION_MAX_AGE_SECONDS } from "./session-config";

// Gard de regresie pe decizia de produs 2026-08-09: sesiune FIXĂ de 7 zile de la ultimul login, nu
// culisantă. O revenire tăcută la default-ul Auth.js (30 zile) sau la o fereastră culisantă (prin
// re-rotirea `exp`) ar trece neobservată fără asta — nu există alt test care să prindă schimbarea
// valorii. Vezi `lib/auth.ts` (consumatorul) și `e2e/auth.setup.ts` (mint-uiește token cu aceeași
// valoare).
describe("SESSION_MAX_AGE_SECONDS", () => {
  it("e fix la 7 zile", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(SESSION_MAX_AGE_SECONDS).toBe(604_800);
  });
});
