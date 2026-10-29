import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/services/detailService", () => ({ getDetail: vi.fn() }));
vi.mock("@/server/services/sketchService", () => ({ getTeancSketch: vi.fn() }));
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
import { getTeancSketch } from "@/server/services/sketchService";
import { REMOVED_AUTHOR_LABEL } from "@/server/domain/sketch";
import Page from "./page";
const id = "11111111-1111-4111-8111-111111111111";
const sketchId = "22222222-2222-4222-8222-222222222222";
const params = () => Promise.resolve({ id, sketchId });
const sketch = {
  id: sketchId,
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
  vi.mocked(getTeancSketch).mockResolvedValue(sketch as never);
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("fara sesiune nu citeste detaliul sau schita", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  await expect(Page({ params: params() })).rejects.toThrow("redirect");
  expect(getDetail).not.toHaveBeenCalled();
  expect(getTeancSketch).not.toHaveBeenCalled();
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("fara acces la detaliu nu citeste schita", async () => {
  vi.mocked(getDetail).mockResolvedValue(null);
  await expect(Page({ params: params() })).rejects.toThrow("notFound");
  expect(getDetail).toHaveBeenCalledWith(id, "reader");
  expect(getTeancSketch).not.toHaveBeenCalled();
});
// **Export PDF din schiță:** pe tabul unei schite din teanc, acelasi „Export PDF” exporta schita activa (imaginea compusa la publicare, autorul si nota), fara discutii. Doar schitele PUBLISHED ale detaliului, cu accesul la detaliu si mascarea autorului retras.
it("schita care nu e in teancul detaliului nu produce documentul", async () => {
  vi.mocked(getTeancSketch).mockResolvedValue(null);
  await expect(Page({ params: params() })).rejects.toThrow("notFound");
  expect(getTeancSketch).toHaveBeenCalledWith(id, sketchId);
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
