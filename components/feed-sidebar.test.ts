import { describe, expect, it } from "vitest";

import { aboutPreview } from "./feed-sidebar";

describe("aboutPreview — preview scurt din câmpul Despre pentru cardul de profil din sidebar", () => {
  it("null → null (nimic de afișat)", () => {
    expect(aboutPreview(null)).toBeNull();
  });

  it("string goală/doar spații → null", () => {
    expect(aboutPreview("   ")).toBeNull();
  });

  it("sub pragul de 14 cuvinte → text integral, fără elipsă", () => {
    expect(aboutPreview("Inginer constructor cu 10 ani experiență în execuție.")).toBe(
      "Inginer constructor cu 10 ani experiență în execuție.",
    );
  });

  it("exact 14 cuvinte → text integral, fără elipsă (limită inclusivă)", () => {
    const words = Array.from({ length: 14 }, (_, i) => `cuvant${i + 1}`);
    expect(aboutPreview(words.join(" "))).toBe(words.join(" "));
  });

  it("peste 14 cuvinte → trunchiat la 14 + elipsă", () => {
    const words = Array.from({ length: 20 }, (_, i) => `cuvant${i + 1}`);
    expect(aboutPreview(words.join(" "))).toBe(words.slice(0, 14).join(" ") + "…");
  });

  it("spații multiple între cuvinte nu produc token-uri goale în numărătoare", () => {
    const words = Array.from({ length: 20 }, (_, i) => `cuvant${i + 1}`);
    expect(aboutPreview(words.join("   "))).toBe(words.slice(0, 14).join(" ") + "…");
  });
});
