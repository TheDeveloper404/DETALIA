import { describe, expect, it, vi } from "vitest";

const { listFeedWithTotal, listUsersByRole } = vi.hoisted(() => ({
  listFeedWithTotal: vi.fn(),
  listUsersByRole: vi.fn(),
}));

// Repo-ul e mock-uit integral: testăm DOAR compunerea din getFeed (page → offset, total → totalPages,
// filtrele trimise la listFeedWithTotal) — SQL-ul propriu-zis (inclusiv atomicitatea db.batch) e
// responsabilitatea integration.spec.ts (contra DB real) + feed-pagination.spec.ts (e2e, pe UI).
vi.mock("@/server/repos/detailsRepo", () => ({
  listFeedWithTotal,
  deleteDetailCascade: vi.fn(),
  deleteSavedDetail: vi.fn(),
  getDetailById: vi.fn(),
  getDetailForEdit: vi.fn(),
  getDetailResources: vi.fn(),
  incrementDetailViews: vi.fn(),
  insertDetailWithRelations: vi.fn(),
  insertSavedDetail: vi.fn(),
  isDetailSavedByUser: vi.fn(),
  listDetailDraftsByAuthor: vi.fn(),
  listTopDebated: vi.fn(),
  listRelatedDetails: vi.fn(),
  listSavedDetailIds: vi.fn(),
  listOfferedDetails: vi.fn(),
  listSavedDetails: vi.fn(),
  publishDetailRow: vi.fn(),
  replaceDetailCategories: vi.fn(),
  replaceDetailResources: vi.fn(),
  updateDetailRow: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ listTopAuthors: vi.fn(), listUsersByRole }));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({ listFeedSketchPreviews: vi.fn().mockResolvedValue([]) }));

import { getFeed, getUsersByRole } from "./detailService";
import { listFeedSketchPreviews } from "@/server/repos/sketchesRepo";

// "La hover peste un detaliu in feed sa fie o succesiune a schitelor din interiorul detaliului in loop"
it("grupeaza miniaturile pe detaliu intr-un singur lot, fara a schimba paginarea", async () => {
  listFeedWithTotal.mockResolvedValueOnce({ rows: [{ id: "d1" }, { id: "d2" }], total: 2 });
  vi.mocked(listFeedSketchPreviews).mockResolvedValueOnce([
    { id: "s1", detailId: "d1", thumbnailUrl: "/s1.png" },
    { id: "s2", detailId: "d2", thumbnailUrl: "/s2.png" },
    { id: "s3", detailId: "d1", thumbnailUrl: null },
    { id: "s4", detailId: "d1", thumbnailUrl: "/s4.png" },
  ]);
  const result = await getFeed();
  expect(listFeedSketchPreviews).toHaveBeenLastCalledWith(["d1", "d2"]);
  expect(result.details.map((detail) => detail.sketchPreviews)).toEqual([
    [{ id: "s1", thumbnailUrl: "/s1.png" }, { id: "s4", thumbnailUrl: "/s4.png" }],
    [{ id: "s2", thumbnailUrl: "/s2.png" }],
  ]);
});

// Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
it("getUsersByRole pastreaza toti utilizatorii, inclusiv peste sase si cu zero postari", async () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    id: `user-${i}`, name: `User ${i}`, image: null, subRole: "Electrician", detailCount: 0,
  }));
  listUsersByRole.mockResolvedValueOnce(rows);
  expect(await getUsersByRole("EXECUTANT")).toBe(rows);
  expect(listUsersByRole).toHaveBeenCalledWith("EXECUTANT", null);
});

describe("getFeed — paginare (50/pagină)", () => {
  it("fără opțiuni → page 1, limit implicit 50, offset 0", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    const res = await getFeed();

    expect(listFeedWithTotal).toHaveBeenCalledWith({ categoryIds: [], q: null, unanswered: false, limit: 50, offset: 0 });
    expect(res).toEqual({ details: [], total: 0, page: 1, totalPages: 1 });
  });

  it("page 3 → offset (page-1)*limit, ACELEAȘI filtre trimise la listFeedWithTotal", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 120 });

    const res = await getFeed({ categoryIds: ["cat-1"], q: " termen ", page: 3 });

    expect(listFeedWithTotal).toHaveBeenCalledWith({ categoryIds: ["cat-1"], q: "termen", unanswered: false, limit: 50, offset: 100 });
    expect(res.totalPages).toBe(3); // 120 / 50 → 3 pagini
  });

  // Filtrul de categorii permite selectarea simultana a mai multor categorii in toata aplicatia; feed-ul include detaliile din oricare categorie selectata, fara dubluri. X elimina doar categoria respectiva din filtru, iar eliminarea ultimei categorii revine la toate detaliile.
  it("trimite toate cele trei categorii impreuna cu cautarea si paginarea", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 75 });
    const categoryIds = ["cat-1", "cat-2", "cat-3"];

    await getFeed({ categoryIds, q: " grinda ", page: 2 });

    expect(listFeedWithTotal).toHaveBeenCalledWith({
      categoryIds,
      q: "grinda",
      unanswered: false,
      limit: 50,
      offset: 50,
    });
  });

  it("page 0 sau negativ (input netrust) → tratat ca pagina 1, nu offset negativ", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    await getFeed({ page: -5 });

    expect(listFeedWithTotal).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("page zecimal (input netrust, apelant direct — NU doar din URL) → cade pe 1, nu OFFSET fracționar", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    await getFeed({ page: 2.5 });

    expect(listFeedWithTotal).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("page peste Number.MAX_SAFE_INTEGER (finit, dar unsafe) → cade pe 1, nu offset Infinity", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    await getFeed({ page: 1e308 });

    expect(listFeedWithTotal).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("limit netrust (apelant direct, nu doar UI) — zecimal/negativ/unsafe → cade pe FEED_PAGE_SIZE (50)", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    await getFeed({ limit: -1 });

    expect(listFeedWithTotal).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("rândurile și totalul vin DINTR-UN SINGUR apel (listFeedWithTotal) — fără o a doua interogare de count", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({
      rows: [{ id: "d1" }, { id: "d2" }] as never,
      total: 120,
    });
    // Nu `.toHaveBeenCalledTimes(1)` — mock-ul e comun testelor din fișier, nu se resetează între ele.
    const callsBefore = vi.mocked(listFeedWithTotal).mock.calls.length;

    const res = await getFeed({ page: 1 });

    expect(vi.mocked(listFeedWithTotal).mock.calls.length).toBe(callsBefore + 1);
    expect(res.total).toBe(120);
    expect(res.totalPages).toBe(3); // 120 / 50 → 3 pagini
    expect(res.details).toEqual([{ id: "d1", sketchPreviews: [] }, { id: "d2", sketchPreviews: [] }]);
  });

  // Regresie Greptile (PR #255, 2026-08-25): 0 rânduri (offset dincolo de ultima pagină) trebuia să
  // recurgă la un al doilea query de count, separat — risc de race între cele două (un detaliu
  // publicat/șters exact între ele putea da un total inconsistent cu rândurile goale). Acum
  // listFeedWithTotal aduce ambele dintr-un SINGUR db.batch atomic, deci nu mai există al doilea apel.
  it("0 rânduri (offset dincolo de ultima pagină) → totalul tot vine din ACELAȘI apel, fără query separat", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 37 });
    const callsBefore = vi.mocked(listFeedWithTotal).mock.calls.length;

    const res = await getFeed({ page: 99 });

    expect(vi.mocked(listFeedWithTotal).mock.calls.length).toBe(callsBefore + 1);
    expect(res.total).toBe(37);
    expect(res.details).toEqual([]);
  });
});
