import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedRoleUsers } from "./feed-role-users";

const users = Array.from({ length: 7 }, (_, i) => ({
  id: `directory-${i}`, name: `Persoana ${i}`, image: null, subRole: "Arhitect", detailCount: 0,
}));

describe("FeedRoleUsers — randare statica", () => {
  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
  it("rezumatul numara toti utilizatorii, previzualizarea contine sase linkuri si Afiseaza in ambele variante", () => {
    const html = renderToStaticMarkup(createElement(FeedRoleUsers, { roleLabel: "Proiectare", users }));
    expect(html).toContain("7 utilizatori");
    expect(html.match(/href="\/profile\//g)).toHaveLength(6);
    expect(html).toContain("0 detalii");
    expect(html.match(/Afișează/g)).toHaveLength(2);
    expect(html).not.toContain("Persoana 6");
  });

  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
  it("la sase utilizatori ramane doar butonul mobil; lista goala explica lipsa rezultatelor", () => {
    const six = renderToStaticMarkup(createElement(FeedRoleUsers, { roleLabel: "Proiectare", users: users.slice(0, 6) }));
    expect(six.match(/Afișează/g)).toHaveLength(1);
    const empty = renderToStaticMarkup(createElement(FeedRoleUsers, { roleLabel: "Proiectare", users: [] }));
    expect(empty).toContain("0 utilizatori");
    expect(empty).toContain("Nu există utilizatori cu acest rol.");
  });

  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate. Conturile suspendate sau sterse nu apar in lista. Cu un judet ales, lista contine doar utilizatorii care l-au setat in profil.
  it("cu judet ales, titlul spune judetul", () => {
    const html = renderToStaticMarkup(
      createElement(FeedRoleUsers, { roleLabel: "Proiectare", county: "Cluj", users }),
    );
    expect(html).toContain("Utilizatori din Proiectare · Cluj");
  });

  it("un singur detaliu se scrie la singular", () => {
    const one = renderToStaticMarkup(
      createElement(FeedRoleUsers, { roleLabel: "Proiectare", users: [{ ...users[0], detailCount: 1 }] }),
    );
    expect(one).toContain("1 detaliu");
    expect(one).not.toContain("1 detalii");
  });
});
