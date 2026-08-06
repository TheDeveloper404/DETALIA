import { describe, expect, it } from "vitest";

import { hasInteractions, resolveDeletionMode } from "./detail";

const none = { comments: 0, validations: 0, sketchesFromOthers: 0 };

describe("resolveDeletionMode — ce face butonul de ștergere pe un detaliu", () => {
  it("fără nicio interacțiune → ștergere completă (comportamentul dinainte)", () => {
    expect(resolveDeletionMode(none)).toBe("HARD_DELETE");
    expect(hasInteractions(none)).toBe(false);
  });

  it("ORICARE dintre cele trei tipuri de interacțiune blochează ștergerea completă", () => {
    expect(resolveDeletionMode({ ...none, comments: 1 })).toBe("ANONYMIZE");
    expect(resolveDeletionMode({ ...none, validations: 1 })).toBe("ANONYMIZE");
    expect(resolveDeletionMode({ ...none, sketchesFromOthers: 1 })).toBe("ANONYMIZE");
  });

  it("combinații multiple → tot ANONYMIZE", () => {
    expect(resolveDeletionMode({ comments: 3, validations: 2, sketchesFromOthers: 1 })).toBe("ANONYMIZE");
  });
});
