import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { MobileCategoryFilter } from "./mobile-category-filter";

const categories = ["Fundatii", "Pereti", "Acoperis"].map((name, i) => ({
  id: `cat-${i}`,
  name,
  parentId: null,
  isGroup: false,
  count: 1,
}));
const render = (activeIds: string[]) =>
  renderToStaticMarkup(
    createElement(MobileCategoryFilter, { categories, activeIds, basePath: "/feed", total: 3 }),
  );

// Filtrul de categorii permite selectarea simultana a mai multor categorii in toata aplicatia; feed-ul include detaliile din oricare categorie selectata, fara dubluri. X elimina doar categoria respectiva din filtru, iar eliminarea ultimei categorii revine la toate detaliile.
it("butonul arata numarul categoriilor selectate si starea activa", () => {
  const three = render(["cat-0", "cat-1", "cat-2"]);
  expect(three).toContain('aria-label="3 categorii"');
  expect(three).toContain("ring-primary");
  const one = render(["cat-1"]);
  expect(one).toContain('aria-label="Pereti"');
  expect(one).toContain("ring-primary");
  const none = render([]);
  expect(none).toContain('aria-label="Categorii"');
  expect(none).not.toContain("ring-primary");
});
