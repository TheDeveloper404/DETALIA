import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SketchOverflowMenu } from "./sketch-overflow-menu";

const entry = { avatarName: null, image: null, roleMain: null, subRole: null, verified: false };

it("butonul arata numarul schitelor si e doar pentru mobil", () => {
  const html = renderToStaticMarkup(
    createElement(SketchOverflowMenu, {
      count: 7,
      activeId: "s1",
      onSelect: () => {},
      entries: [
        { ...entry, id: null, label: "Autor", ordinal: null },
        ...Array.from({ length: 7 }, (_, i) => ({ ...entry, id: `s${i + 1}`, label: `Autor ${i}`, ordinal: 1 })),
      ],
    }),
  );
  expect(html).toContain(">7</button>");
  expect(html).toContain('aria-label="Toate schițele (7)"');
  expect(html).toContain("sm:hidden");
  // Lista se deschide doar la apasare.
  expect(html).not.toContain('role="dialog"');
});
