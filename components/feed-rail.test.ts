import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedRail, type RailDebated } from "./feed-rail";

const debated: RailDebated[] = Array.from({ length: 5 }, (_, i) => ({
  id: `detail-${i}`,
  title: `Dezbatere ${i}`,
  categories: [{ id: "category", name: "Categorie de eliminat", slug: "categorie" }],
  authorId: i === 0 ? null : "author",
  authorName: i === 0 ? null : "Autor test",
  authorImage: null,
  authorRoleMain: "PROIECTANT",
  authorSubRole: "Arhitect",
  authorVerification: null,
  validationCount: 2,
  commentCount: 5 - i,
  sketchCount: 1,
}));

describe("FeedRail — varianta editoriala", () => {
  // Cerinta: "nu treci acele texte Fatade +1, Acoperisuri, Structura" + "as vra sa fie 5 cele mai dezbatute".
  it("afiseaza cele cinci titluri fara categorii si pastreaza metadatele si linkurile separate", () => {
    const html = renderToStaticMarkup(createElement(FeedRail, { authors: [], debated }));
    expect(html.match(/href="\/details\//g)).toHaveLength(5);
    expect(html).not.toContain("Categorie de eliminat");
    expect(html.indexOf("Dezbatere 1")).toBeLessThan(html.indexOf("Autor test"));
    expect(html).toContain("5 comentarii");
    expect(html).toContain("1 comentariu");
    expect(html).toContain("1 schiță");
    expect(html).not.toContain("1 schițe");
    expect(html).toContain('href="/ghid"');
  });

  // Regula existenta: "Autor retras (authorId mascat null în SQL) → fără link, doar text."
  it("autorul anonim ramane fara link de profil, iar ceilalti autori au link", () => {
    const html = renderToStaticMarkup(createElement(FeedRail, { authors: [], debated }));
    expect(html).toContain("Anonim");
    expect(html.match(/href="\/profile\/author"/g)).toHaveLength(4);
    expect(html).not.toContain('/profile/null');
  });
});
