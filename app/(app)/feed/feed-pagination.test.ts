import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { FeedPagination } from "./feed-pagination";

// Filtrul de categorii permite selectarea simultana a mai multor categorii in toata aplicatia; feed-ul include detaliile din oricare categorie selectata, fara dubluri. X elimina doar categoria respectiva din filtru, iar eliminarea ultimei categorii revine la toate detaliile.
it("linkurile de pagina pastreaza toate categoriile selectate", () => {
  const html = renderToStaticMarkup(
    createElement(FeedPagination, { page: 1, totalPages: 3, categoryIds: ["a", "b", "c"], q: null }),
  );
  expect(html).toContain('href="/feed?cat=a%2Cb%2Cc&amp;page=2"');
});
