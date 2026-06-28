import { describe, expect, it } from "vitest";

import { COMMENT_MAX_LENGTH, validateCommentBody, validateJustification } from "./validation";

describe("validateJustification — „nu există dezaprobare mută”", () => {
  it("respinge gol / null / undefined cu REQUIRED", () => {
    expect(validateJustification(null)).toEqual({ ok: false, error: "REQUIRED" });
    expect(validateJustification(undefined)).toEqual({ ok: false, error: "REQUIRED" });
    expect(validateJustification("")).toEqual({ ok: false, error: "REQUIRED" });
  });

  it("respinge doar-spații cu REQUIRED (whitespace ≠ justificare)", () => {
    expect(validateJustification("   \n\t ")).toEqual({ ok: false, error: "REQUIRED" });
  });

  it("respinge peste limită cu TOO_LONG", () => {
    expect(validateJustification("x".repeat(COMMENT_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });

  it("acceptă text valid și îl trimează", () => {
    expect(validateJustification("  detaliul nu rezistă la îngheț  ")).toEqual({
      ok: true,
      value: "detaliul nu rezistă la îngheț",
    });
  });
});

describe("validateCommentBody — aceleași reguli ca justificarea", () => {
  it("respinge gol, acceptă valid", () => {
    expect(validateCommentBody("")).toEqual({ ok: false, error: "REQUIRED" });
    expect(validateCommentBody("ok").ok).toBe(true);
  });
});
