import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/services/detailService", () => ({ getDetail: vi.fn() }));
vi.mock("@/server/services/sketchService", () => ({ getPrintStack: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
import { auth } from "@/lib/auth";
import { getDetail } from "@/server/services/detailService";
import { getPrintStack } from "@/server/services/sketchService";
import { REMOVED_AUTHOR_LABEL } from "@/server/domain/sketch";
import Page from "./page";
const id = "11111111-1111-4111-8111-111111111111";
const sketchId = "22222222-2222-4222-8222-222222222222";
const params = () => Promise.resolve({ id, sketchId });
const sketch = {
  id: sketchId,
  authorId: "",
  thumbnailUrl: null,
  note: "Nota <img src=x>",
  authorRemoved: true,
  authorName: null,
  authorRoleMain: "EXECUTANT",
  authorSubRole: null,
  authorVerification: "DECLARED",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "reader" } } as never);
  vi.mocked(getDetail).mockResolvedValue({ id, title: "Detaliu <script>bad</script>" } as never);
  vi.mocked(getPrintStack).mockResolvedValue({ activeSketch: sketch, layers: [{ id: sketch.id, source: "sketch", layer: sketch }], printStrokes: [] } as never);
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("fara sesiune nu citeste detaliul sau schita", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  await expect(Page({ params: params() })).rejects.toThrow("redirect");
  expect(getDetail).not.toHaveBeenCalled();
  expect(getPrintStack).not.toHaveBeenCalled();
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("fara acces la detaliu nu citeste schita", async () => {
  vi.mocked(getDetail).mockResolvedValue(null);
  await expect(Page({ params: params() })).rejects.toThrow("notFound");
  expect(getDetail).toHaveBeenCalledWith(id, "reader");
  expect(getPrintStack).not.toHaveBeenCalled();
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("schita care nu e in teancul detaliului nu produce documentul", async () => {
  vi.mocked(getPrintStack).mockResolvedValue(null);
  await expect(Page({ params: params() })).rejects.toThrow("notFound");
  expect(getPrintStack).toHaveBeenCalledWith(id, undefined, sketchId);
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("documentul mascheaza autorul retras si escapeaza continutul introdus de user", async () => {
  const html = renderToStaticMarkup(await Page({ params: params() }));
  expect(html).toContain(REMOVED_AUTHOR_LABEL);
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img src=x&gt;");
  expect(html).not.toContain("<script>bad");
  expect(html).toContain("/details/" + id + "?sketch=" + sketchId);
});

// "Logo Detalia"; "Slogan \"Detaliile bune se construiesc impreuna\""; "Autor Detaliu"
// "Descrierea tuturor schitelor din teanc cu numele autorilor atasat langa descrieri"
it("include brandul, autorul detaliului si toate notele, cu autorii deduplicati in lista", async () => {
  vi.mocked(getDetail).mockResolvedValue({ id, title: "Detaliu", authorName: "Autor detaliu" } as never);
  const layers = [
    { ...sketch, authorRemoved: false, authorId: "autor-a", authorName: "Autor A", note: "Explicatia A" },
    { ...sketch, id: "s2", authorRemoved: false, authorId: "autor-b", authorName: "Autor B", note: "Explicatia B" },
    { ...sketch, id: "s3", authorRemoved: false, authorId: "autor-a", authorName: "Autor A", note: "Alta explicatie A" },
  ];
  vi.mocked(getPrintStack).mockResolvedValue({ activeSketch: sketch, layers: layers.map((layer) => ({ id: layer.id, source: "sketch", layer })), printStrokes: [] } as never);
  const html = renderToStaticMarkup(await Page({ params: params() }));
  expect(html).toContain('src="/logo.svg"');
  expect(html).toContain("Detaliile bune se construiesc impreuna");
  expect(html).toContain("Autor detaliu:</strong> Autor detaliu");
  const authors = html.match(/<ul[^>]*>(.*?)<\/ul>/)![1];
  expect(authors.match(/Autor A/g)).toHaveLength(1);
  expect(authors).toContain("Autor B");
  expect(html).toMatch(/Schița 1 · Autor A<\/h3><p[^>]*>Explicatia A/);
  expect(html).toMatch(/Schița 2 · Autor B<\/h3><p[^>]*>Explicatia B/);
  expect(html).toMatch(/Schița 3 · Autor A<\/h3><p[^>]*>Alta explicatie A/);
});

// "Daca este o singura schita, autorul ei."
it("o singura schita include autorul ei si indica lipsa unei descrieri", async () => {
  const layer = { ...sketch, authorRemoved: false, authorId: "autor", authorName: "Autor unic", note: null };
  vi.mocked(getPrintStack).mockResolvedValue({ activeSketch: sketch, layers: [{ id: layer.id, source: "sketch", layer }], printStrokes: [] } as never);
  const html = renderToStaticMarkup(await Page({ params: params() }));
  expect(html).toMatch(/<li[^>]*>Autor unic<\/li>/);
  expect(html).toContain("Schița 1 · Autor unic");
  expect(html).toContain("Fără descriere.");
});

// "Aceleasi reguli de acces si anonimizare ca la detaliu."
it("nu afiseaza numele autorului retras al detaliului", async () => {
  vi.mocked(getDetail).mockResolvedValue({ id, title: "Detaliu", authorName: "Nume retras secret", authorRemovedFromProject: true } as never);
  const html = renderToStaticMarkup(await Page({ params: params() }));
  expect(html).not.toContain("Nume retras secret");
  expect(html).toContain("Autor detaliu:</strong> " + REMOVED_AUTHOR_LABEL);
});

// "Tot teancul ... asa cum la Schiteaza ramane inghetat tot teancul deschis in momentul apasarii".
it("transmite lista capturata service-ului si nu afiseaza URL-ul lung in document", async () => {
  const base = "33333333-3333-4333-8333-333333333333";
  const tree = await Page({ params: params(), searchParams: Promise.resolve({ stack: `${base},${sketchId}` }) });
  expect(getPrintStack).toHaveBeenCalledWith(id, [base, sketchId], sketchId);
  const html = renderToStaticMarkup(tree);
  expect(html).toContain("Vezi detaliul pe DETALIA");
  expect(html).not.toContain(`Schiță: https://`);
});
