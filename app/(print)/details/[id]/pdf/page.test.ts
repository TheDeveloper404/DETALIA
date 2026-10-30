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
import { StackPrintDocument } from "./stack-print-document";
const id = "11111111-1111-4111-8111-111111111111";
const fixture = {
  id,
  title: "Detaliu <script>bad</script>",
  authorName: "Nume ascuns",
  authorRoleMain: "EXECUTANT",
  authorSubRole: null,
  authorVerification: "DECLARED",
  authorRemovedFromProject: true,
  categories: [],
  resources: [{ id: "r1", body: "Nota <img src=x>", url: null }],
  description: "Descriere",
  imageUrl: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "reader" } } as never);
  vi.mocked(getDetail).mockResolvedValue(fixture as never);
});
// **Export PDF:** vizualizare autentificata pentru tiparire cu imaginea de baza, metadatele si resursele detaliului; userul alege salvarea PDF in dialogul browserului. Aceleasi reguli de acces si anonimizare ca la detaliu.
it("fara sesiune nu citeste detaliul", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("redirect");
  expect(getDetail).not.toHaveBeenCalled();
});
// **Export PDF:** vizualizare autentificata pentru tiparire cu imaginea de baza, metadatele si resursele detaliului; userul alege salvarea PDF in dialogul browserului. Aceleasi reguli de acces si anonimizare ca la detaliu.
it("acces refuzat nu produce documentul", async () => {
  vi.mocked(getDetail).mockResolvedValue(null);
  await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  expect(getDetail).toHaveBeenCalledWith(id, "reader");
});
// **Export PDF:** vizualizare autentificata pentru tiparire cu imaginea de baza, metadatele si resursele detaliului; userul alege salvarea PDF in dialogul browserului. Aceleasi reguli de acces si anonimizare ca la detaliu.
it("documentul mascheaza fostul membru si escapeaza continutul introdus de user", async () => {
  const page = await Page({ params: Promise.resolve({ id }) });
  expect(StackPrintDocument(page.props).props.children.props.veil).toBe(false);
  const html = renderToStaticMarkup(page);
  expect(html).toContain(REMOVED_AUTHOR_LABEL);
  expect(html).not.toContain("Nume ascuns");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img src=x&gt;");
  expect(html).not.toContain("<script>bad");
});

// "Trebuie sa pot salva tot teancul la care privesc in momentul salvarii."
it("exporta adnotarea deschisa cu acelasi voal si explicatie ca in workspace", async () => {
  const annotationId = "22222222-2222-4222-8222-222222222222";
  const strokes = [{ color: "#a45035", size: 4, points: [[0.2, 0.3]] }];
  vi.mocked(getPrintStack).mockResolvedValueOnce({ activeSketch: null, printStrokes: strokes,
    layers: [{ id: annotationId, source: "annotation", layer: { note: "Explicatia adnotarii" } }] } as never);
  const page = await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ stack: annotationId }) });
  expect(getPrintStack).toHaveBeenCalledWith(id, [annotationId]);
  expect(StackPrintDocument(page.props).props.children.props).toMatchObject({ veil: true, strokes });
  const html = renderToStaticMarkup(page);
  expect(html).toContain("Adnotarea autorului");
  expect(html).toContain("Explicatia adnotarii");
  expect(html).not.toContain("Nume ascuns");
});
