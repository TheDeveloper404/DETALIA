import { describe, expect, it } from "vitest";

import { foldDiacritics } from "./diacritics";

describe("foldDiacritics", () => {
  it("elimină diacriticele românești (virgulă dedesubt), păstrează restul neschimbat", () => {
    expect(foldDiacritics("Ușă și poartă pentru terasă")).toBe("Usa si poarta pentru terasa");
  });

  it("elimină și varianta cu sedilă (ş/ţ)", () => {
    expect(foldDiacritics("uşă şi poartă cu ţeavă")).toBe("usa si poarta cu teava");
  });

  it("majuscule cu diacritice → majuscule fără", () => {
    expect(foldDiacritics("ȚEAVĂ ȘI ÎNCĂ UNA")).toBe("TEAVA SI INCA UNA");
  });

  it("text fără diacritice → neschimbat (identitate)", () => {
    expect(foldDiacritics("beton armat clasic")).toBe("beton armat clasic");
  });

  it("păstrează lungimea EXACTĂ a textului (substituție 1-la-1, nu normalizare Unicode)", () => {
    const text = "Ușă, poartă și țeavă — trei cuvinte, ĂÂÎȘȚ toate";
    expect(foldDiacritics(text).length).toBe(text.length);
  });

  it("șir gol → șir gol", () => {
    expect(foldDiacritics("")).toBe("");
  });
});
