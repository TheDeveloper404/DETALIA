import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SketchOverflowMenu, sketchNoun } from "./sketch-overflow-menu";

const entry = { avatarName: null, image: null, roleMain: null, subRole: null, verified: false };

it("butonul arata cate schite sunt ascunse si e doar pentru mobil", () => {
  const html = renderToStaticMarkup(
    createElement(SketchOverflowMenu, {
      hiddenCount: 6,
      activeId: "s1",
      onSelect: () => {},
      entries: [
        { ...entry, id: null, label: "Autor", ordinal: null },
        ...Array.from({ length: 7 }, (_, i) => ({ ...entry, id: `s${i + 1}`, label: `Autor ${i}`, ordinal: 1 })),
      ],
    }),
  );
  expect(html).toContain("+6");
  expect(html).toContain('aria-label="Încă 6 schițe"');
  expect(html).toContain("sm:hidden");
  // Lista se deschide doar la apasare.
  expect(html).not.toContain("Toate schițele");
});

it("o singura schita ascunsa se scrie la singular", () => {
  const html = renderToStaticMarkup(
    createElement(SketchOverflowMenu, { hiddenCount: 1, activeId: null, onSelect: () => {}, entries: [] }),
  );
  expect(html).toContain('aria-label="Încă 1 schiță"');
});

it("pluralul romanesc: schiță / schițe / de schițe", () => {
  expect(sketchNoun(1)).toBe("schiță");
  expect(sketchNoun(2)).toBe("schițe");
  expect(sketchNoun(19)).toBe("schițe");
  expect(sketchNoun(20)).toBe("de schițe");
  expect(sketchNoun(25)).toBe("de schițe");
  expect(sketchNoun(100)).toBe("de schițe");
  expect(sketchNoun(101)).toBe("schițe");
  expect(sketchNoun(119)).toBe("schițe");
  expect(sketchNoun(120)).toBe("de schițe");
});
