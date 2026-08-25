import { describe, expect, it } from "vitest";

import { generateReferralCode, isValidReferralCodeFormat, REFERRAL_CODE_LENGTH } from "./referral";

describe("generateReferralCode", () => {
  it(`generează un cod de exact ${REFERRAL_CODE_LENGTH} caractere`, () => {
    expect(generateReferralCode()).toHaveLength(REFERRAL_CODE_LENGTH);
  });

  it("codul generat trece propria validare de format", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidReferralCodeFormat(generateReferralCode())).toBe(true);
    }
  });

  it("nu conține caractere ambigue (0/O/1/I)", () => {
    const ambiguous = ["0", "O", "1", "I"];
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      for (const c of ambiguous) expect(code).not.toContain(c);
    }
  });
});

describe("isValidReferralCodeFormat", () => {
  it("lungime greșită → invalid", () => {
    expect(isValidReferralCodeFormat("ABC")).toBe(false);
    expect(isValidReferralCodeFormat("ABCDEFGHIJ")).toBe(false);
  });

  it("caracter ambiguu/nepermis (0/O/1/I/L, litere mici, simboluri) → invalid", () => {
    expect(isValidReferralCodeFormat("ABCDEFG0")).toBe(false);
    expect(isValidReferralCodeFormat("ABCDEFGO")).toBe(false);
    expect(isValidReferralCodeFormat("abcdefgh")).toBe(false);
    expect(isValidReferralCodeFormat("ABCDEF-2")).toBe(false);
  });

  it("cod valid din alfabetul permis → valid", () => {
    expect(isValidReferralCodeFormat("23456789")).toBe(true);
  });
});
