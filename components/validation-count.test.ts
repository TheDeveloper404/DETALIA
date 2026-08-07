import { describe, expect, it } from "vitest";

import { computeOptimisticValidationCount } from "./validation-count";

describe("computeOptimisticValidationCount — ajustare optimistă a count-ului lângă iconița de validare", () => {
  it("fără poziție → Aprob (optimist) → +1", () => {
    expect(computeOptimisticValidationCount(4, null, "APPROVE")).toBe(5);
  });

  it("fără poziție → Dezaprob (optimist) → +1", () => {
    expect(computeOptimisticValidationCount(4, null, "DISAPPROVE")).toBe(5);
  });

  it("aprobat → Retrage (optimist, devine null) → -1", () => {
    expect(computeOptimisticValidationCount(5, "APPROVE", null)).toBe(4);
  });

  it("dezaprobat → Retrage (optimist, devine null) → -1", () => {
    expect(computeOptimisticValidationCount(5, "DISAPPROVE", null)).toBe(4);
  });

  it("fără poziție și fără schimbare optimistă → count neschimbat", () => {
    expect(computeOptimisticValidationCount(3, null, null)).toBe(3);
  });

  it("poziție existentă, fără schimbare optimistă (render intermediar) → count neschimbat", () => {
    expect(computeOptimisticValidationCount(3, "APPROVE", "APPROVE")).toBe(3);
  });

  it("count la 0, prima validare → 1, fără valori negative posibile din alt scenariu", () => {
    expect(computeOptimisticValidationCount(0, null, "APPROVE")).toBe(1);
  });
});
