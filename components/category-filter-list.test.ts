import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryFilterList, type SidebarCategory } from "./category-filter-list";

const cat = (id: string, name: string, parentId: string | null, isGroup = false): SidebarCategory => ({
  id, name, parentId, isGroup, count: 1,
});
const categories = [
  cat("zona", "Clasificare dupa zona", null, true),
  cat("fatada", "Fatada", "zona", true),
  cat("ventilata", "Fatada ventilata", "fatada"),
  cat("perete", "Perete", "zona"),
  cat("sistem", "Clasificare dupa sistem constructiv", null, true),
  cat("clt", "Sistem CLT", "sistem"),
];
const render = (activeIds: string[], sidebar: boolean) =>
  renderToStaticMarkup(
    createElement(CategoryFilterList, { categories, activeIds, basePath: "/feed", total: 3, sidebar }),
  );
// Numele categoriilor afisate ca link de filtru (href-ul contine si filtrele deja active, deci nu e cheia).
const leafLinks = (html: string) =>
  [...html.matchAll(/<a [^>]*href="\/feed\?cat=[^"]*"[^>]*>([^<]+)/g)].map((m) => m[1]);

// Varianta B aprobata pentru coloana Categorii de pe desktop: „2×2, inchise, una” — sectiunile pornesc
// inchise, se deschide una singura odata; sheet-ul de pe mobil ramane neschimbat.
describe("CategoryFilterList — coloana de desktop", () => {
  it("fara filtru activ toate sectiunile sunt inchise si se vede doar „Toate detaliile”", () => {
    const html = render([], true);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
    expect(html).not.toContain('aria-expanded="true"');
    expect(leafLinks(html)).toEqual([]);
    expect(html).toContain("Toate detaliile");
  });

  it("sectiunea si capitolul care contin categoria activa pornesc deschise, restul raman inchise", () => {
    const html = render(["ventilata"], true);
    expect(leafLinks(html)).toEqual(expect.arrayContaining(["Fatada ventilata", "Perete"]));
    expect(leafLinks(html)).not.toContain("Sistem CLT");
    expect(html).toContain("Scoate filtrul Fatada ventilata");
  });

  it("cu filtre active in doua sectiuni se deschide sectiunea ultimei categorii alese, cealalta e marcata", () => {
    const html = render(["perete", "clt"], true);
    expect(leafLinks(html)).toContain("Sistem CLT");
    expect(leafLinks(html)).not.toContain("Perete");
    expect(html.match(/\(filtru activ\)/g)).toHaveLength(1);

    const reversed = render(["clt", "perete"], true);
    expect(leafLinks(reversed)).toContain("Perete");
    expect(leafLinks(reversed)).not.toContain("Sistem CLT");
  });
});

describe("CategoryFilterList — sheet-ul de pe mobil", () => {
  it("pastreaza antetele de sectiune fixe si toate categoriile vizibile, fara butoane de sectiune", () => {
    const html = render([], false);
    expect(leafLinks(html)).toEqual(expect.arrayContaining(["Perete", "Sistem CLT"]));
    expect(html).toContain("Clasificare dupa zona");
    expect(html.match(/aria-expanded/g)).toHaveLength(1);
  });
});
