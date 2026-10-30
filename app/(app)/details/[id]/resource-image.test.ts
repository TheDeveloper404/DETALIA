import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ResourceImage } from "./resource-image";

it("arata un control Imagine compact, fara thumbnail permanent", () => {
  const html = renderToStaticMarkup(createElement(ResourceImage, { url: "/pwa-512.png", alt: "Detaliu test" }));
  expect(html).toContain('aria-label="Mărește imaginea: Detaliu test"');
  expect(html).toContain("Imagine");
  expect(html).not.toContain("<img");
  expect(html).not.toContain('role="dialog"');
});
