import { describe, expect, it, vi } from "vitest";

const { listFeed, countFeedMatches } = vi.hoisted(() => ({
  listFeed: vi.fn(),
  countFeedMatches: vi.fn(),
}));

// Repo-ul e mock-uit integral: testăm DOAR compunerea din getFeed (page → offset, total → totalPages,
// filtrele IDENTICE trimise la listFeed și countFeedMatches) — SQL-ul propriu-zis e responsabilitatea
// integration.spec.ts (contra DB real) + feed-pagination.spec.ts (e2e, pe UI).
vi.mock("@/server/repos/detailsRepo", () => ({
  listFeed,
  countFeedMatches,
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
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(0);

    const res = await getFeed();

    expect(listFeed).toHaveBeenCalledWith({ categoryId: null, q: null, limit: 50, offset: 0 });
    expect(countFeedMatches).toHaveBeenCalledWith({ categoryId: null, q: null });
    expect(res).toEqual({ details: [], total: 0, page: 1, totalPages: 1 });
  });

  it("page 3 → offset (page-1)*limit, ACELEAȘI filtre pe listFeed și countFeedMatches", async () => {
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(120);

    const res = await getFeed({ categoryId: "cat-1", q: " termen ", page: 3 });

    expect(listFeed).toHaveBeenCalledWith({ categoryId: "cat-1", q: "termen", limit: 50, offset: 100 });
    expect(countFeedMatches).toHaveBeenCalledWith({ categoryId: "cat-1", q: "termen" });
    expect(res.totalPages).toBe(3); // 120 / 50 → 3 pagini
  });

  it("page 0 sau negativ (input netrust) → tratat ca pagina 1, nu offset negativ", async () => {
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(0);

    await getFeed({ page: -5 });

    expect(listFeed).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("page zecimal (input netrust, apelant direct — NU doar din URL) → cade pe 1, nu OFFSET fracționar", async () => {
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(0);

    await getFeed({ page: 2.5 });

    expect(listFeed).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("page peste Number.MAX_SAFE_INTEGER (finit, dar unsafe) → cade pe 1, nu offset Infinity", async () => {
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(0);

    await getFeed({ page: 1e308 });

    expect(listFeed).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it("limit netrust (apelant direct, nu doar UI) — zecimal/negativ/unsafe → cade pe FEED_PAGE_SIZE (50)", async () => {
    vi.mocked(listFeed).mockResolvedValueOnce([]);
    vi.mocked(countFeedMatches).mockResolvedValueOnce(0);

    await getFeed({ limit: -1 });

    expect(listFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });
});
