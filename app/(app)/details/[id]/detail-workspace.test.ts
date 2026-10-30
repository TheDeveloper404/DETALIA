import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ sketch: null as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/details/detail-1",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.sketch ? { sketch: route.sketch } : {}),
}));
vi.mock("./sketch-review-actions", () => ({ deleteSketchAction: vi.fn(), startSketchAction: vi.fn() }));
vi.mock("./comments-section", () => ({ CommentsSection: () => null }));
vi.mock("./validation-panel", () => ({ ValidationPanel: () => null }));
vi.mock("./supplier-offer-panel", () => ({ SupplierOfferButton: () => null, SupplierOfferPanel: () => null }));
vi.mock("./material-offer-panel", () => ({ MaterialOfferPanel: () => null }));
vi.mock("@/components/detail-product-tour", () => ({ DetailProductTour: () => null }));
vi.mock("./detail-actions-menu", () => ({
  DetailActionsMenu: ({ activeSketchPublicId }: { activeSketchPublicId: string | null }) =>
    createElement("button", { "aria-label": "Acțiuni detaliu", "data-sketch": activeSketchPublicId }),
}));

import { formatDate } from "@/lib/format";
import { DetailWorkspace } from "./detail-workspace";

const author = { id: "author-1", name: "Autor detaliu", image: null, roleMain: "ARHITECT", subRole: null, verification: null };
const validation = { counts: { approve: 0, disapprove: 0 }, myPosition: null, positions: [] };
const createdAt = new Date("2026-10-29T10:00:00Z");
const props: ComponentProps<typeof DetailWorkspace> = {
  detailId: "detail-1", imageUrl: "/pwa-512.png",
  header: {
    title: "Racord fereastra", description: "Descrierea integrala a detaliului", createdAt,
    categories: [{ id: "category-1", name: "Anvelopa" }], location: "România", climateZone: null,
    seismicAg: "General", seismicTc: "General", snowLoad: "General", windLoad: "General", isSaved: false,
  },
  detailAuthor: author, detailValidation: validation, isDetailAuthor: false,
  annotations: [{ id: "annotation-1", strokes: [], note: "Explicatia adnotarii" }],
  sketches: [{
    id: "sketch-1", author: { ...author, id: "author-2", name: "Autor schita" }, strokes: [],
    note: "Explicatia schitei selectate", validation, createdAt, baseSketchIds: [], authorRemoved: false, lockedAt: null,
  }],
  comments: [], supplierOffers: [], materialOffers: [], isDetailPublic: true,
};

beforeEach(() => { route.sketch = null; });

// "Și data publicării să fie deasupra titlului în colț dreapta sus."
it("pastreaza data inaintea titlului si resursele serverului in zona de informatii", () => {
  const html = renderToStaticMarkup(createElement(DetailWorkspace, {
    ...props, resources: createElement("a", { href: "https://example.test/fisa.pdf" }, "Fisa tehnica"),
  }));
  expect(html.indexOf(formatDate(createdAt))).toBeLessThan(html.indexOf("<h1"));
  const information = html.slice(html.indexOf('data-testid="detail-information"'), html.indexOf('data-tour="detail-tabs"'));
  expect(information).toContain(props.header.description);
  expect(information).toContain('href="https://example.test/fisa.pdf"');
  expect(information).toContain("Fisa tehnica");
  expect(html.match(/aria-label="Acțiuni detaliu"/g)).toHaveLength(1);
  expect(html.match(/aria-label="Schițează"/g)).toHaveLength(1);
});

// "Și partea de explicații pe care le lasă userii, sa fie acolo in partea de jos"
it("leaga explicatia de adnotarea sau schita deschisa, fara amestecarea textelor", () => {
  const base = renderToStaticMarkup(createElement(DetailWorkspace, props));
  expect(base).toContain("Explicatia adnotarii");
  expect(base).not.toContain("Explicatia schitei selectate");
  route.sketch = "sketch-1";
  const selected = renderToStaticMarkup(createElement(DetailWorkspace, props));
  expect(selected).toContain("Explicatia schitei selectate");
  expect(selected).not.toContain("Explicatia adnotarii");
  expect(selected).toContain('data-sketch="sketch-1"');
  expect(selected.match(/data-testid="detail-explanation"/g)).toHaveLength(1);
});

it("nu afiseaza o zona goala pentru o schita fara explicatie sau resurse inexistente", () => {
  route.sketch = "sketch-1";
  const html = renderToStaticMarkup(createElement(DetailWorkspace, {
    ...props, sketches: [{ ...props.sketches[0], note: null }],
  }));
  expect(html).not.toContain('data-testid="detail-explanation"');
  expect(html).not.toContain('data-testid="detail-resources"');
});

it("pastreaza integral descrierile si explicatiile lungi", () => {
  route.sketch = "sketch-1";
  const description = "Descriere detaliata. ".repeat(150);
  const note = "Explicatie detaliata. ".repeat(100);
  const html = renderToStaticMarkup(createElement(DetailWorkspace, {
    ...props, header: { ...props.header, description }, sketches: [{ ...props.sketches[0], note }],
  }));
  expect(html).toContain(description);
  expect(html).toContain(note);
});
