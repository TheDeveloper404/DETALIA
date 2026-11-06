import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/feed/actions", () => ({ getRoleDirectoryPageAction: vi.fn() }));

import { FeedRoleUsers } from "./feed-role-users";

const users = Array.from({ length: 6 }, (_, i) => ({
  id: `directory-${i}`, name: `Persoana ${i}`, image: null, subRole: "Arhitect", detailCount: 0,
}));
const base = { role: "PROIECTANT", roleLabel: "Proiectare" };

describe("FeedRoleUsers — randare statica", () => {
  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
  // "Directorul de utilizatori din feed — count + primele 6 la filtrare; lista completa incarcata paginat doar la deschiderea modalului."
  it("rezumatul arata totalul primit de la server, previzualizarea contine sase linkuri si Afiseaza in ambele variante", () => {
    const html = renderToStaticMarkup(createElement(FeedRoleUsers, { ...base, total: 51, users }));
    expect(html).toContain("51 utilizatori");
    expect(html.match(/href="\/profile\//g)).toHaveLength(6);
    expect(html).toContain("0 detalii");
    expect(html.match(/Afișează/g)).toHaveLength(2);
  });

  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
  it("la sase utilizatori ramane doar butonul mobil; lista goala explica lipsa rezultatelor", () => {
    const six = renderToStaticMarkup(createElement(FeedRoleUsers, { ...base, total: 6, users }));
    expect(six.match(/Afișează/g)).toHaveLength(1);
    const empty = renderToStaticMarkup(createElement(FeedRoleUsers, { ...base, total: 0, users: [] }));
    expect(empty).toContain("0 utilizatori");
    expect(empty).toContain("Nu există utilizatori cu acest rol.");
  });

  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate. Conturile suspendate sau sterse nu apar in lista. Cu un judet ales, lista contine doar utilizatorii care l-au setat in profil.
  it("cu judet ales, titlul spune judetul", () => {
    const html = renderToStaticMarkup(
      createElement(FeedRoleUsers, { ...base, county: "Cluj", total: 6, users }),
    );
    expect(html).toContain("Utilizatori din Proiectare · Cluj");
  });

  it("un singur detaliu si un singur utilizator se scriu la singular", () => {
    const one = renderToStaticMarkup(
      createElement(FeedRoleUsers, { ...base, total: 1, users: [{ ...users[0], detailCount: 1 }] }),
    );
    expect(one).toContain("1 detaliu");
    expect(one).not.toContain("1 detalii");
    expect(one).toContain("1 utilizator<");
  });
});
