import { describe, expect, it } from "vitest";

import { highlightMatches } from "./highlight";

describe("highlightMatches", () => {
  it("termen gol → tot textul, un singur segment nepotrivit", () => {
    expect(highlightMatches("Hidroizolație terasă", "")).toEqual([
      { text: "Hidroizolație terasă", matched: false },
    ]);
  });

  it("termen doar spații → același comportament ca gol", () => {
    expect(highlightMatches("Hidroizolație terasă", "   ")).toEqual([
      { text: "Hidroizolație terasă", matched: false },
    ]);
  });

  it("potrivire simplă, case-insensitive — segmentul potrivit păstrează CASE-ul din text", () => {
    expect(highlightMatches("Hidroizolație terasă", "hidro")).toEqual([
      { text: "Hidro", matched: true },
      { text: "izolație terasă", matched: false },
    ]);
  });

  it("mai multe potriviri ale aceluiași termen → toate evidențiate", () => {
    expect(highlightMatches("beton peste beton", "beton")).toEqual([
      { text: "beton", matched: true },
      { text: " peste ", matched: false },
      { text: "beton", matched: true },
    ]);
  });

  it("fără nicio potrivire → tot textul, un singur segment nepotrivit", () => {
    expect(highlightMatches("Hidroizolație terasă", "xyz")).toEqual([
      { text: "Hidroizolație terasă", matched: false },
    ]);
  });

  it("caractere speciale regex în termen — tratate literal, nu aruncă", () => {
    expect(() => highlightMatches("Detaliu (variantă 2)", "(variantă")).not.toThrow();
    expect(highlightMatches("Detaliu (variantă 2)", "(variantă")).toEqual([
      { text: "Detaliu ", matched: false },
      { text: "(variantă", matched: true },
      { text: " 2)", matched: false },
    ]);
  });
});
