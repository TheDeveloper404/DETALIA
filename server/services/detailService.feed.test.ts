import { describe, expect, it, vi } from "vitest";

const { listFeedWithTotal } = vi.hoisted(() => ({
  listFeedWithTotal: vi.fn(),
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
vi.mock("@/server/repos/usersRepo", () => ({ listTopAuthors: vi.fn() }));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { getFeed } from "./detailService";

describe("getFeed — paginare (50/pagină)", () => {
  it("fără opțiuni → page 1, limit implicit 50, offset 0", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 0 });

    const res = await getFeed();

    expect(listFeedWithTotal).toHaveBeenCalledWith({ categoryId: null, q: null, limit: 50, offset: 0 });
    expect(res).toEqual({ details: [], total: 0, page: 1, totalPages: 1 });
  });

  it("page 3 → offset (page-1)*limit, ACELEAȘI filtre trimise la listFeedWithTotal", async () => {
    vi.mocked(listFeedWithTotal).mockResolvedValueOnce({ rows: [], total: 120 });

    const res = await getFeed({ categoryId: "cat-1", q: " termen ", page: 3 });

    expect(listFeedWithTotal).toHaveBeenCalledWith({ categoryId: "cat-1", q: "termen", limit: 50, offset: 100 });
    expect(res.totalPages).toBe(3); // 120 / 50 → 3 pagini
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
    expect(res.details).toEqual([{ id: "d1" }, { id: "d2" }]);
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
