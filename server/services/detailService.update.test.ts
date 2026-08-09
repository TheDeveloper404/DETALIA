import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-001 (audit 2026-08-07): `updateDetail` folosea `existing.authorId` (coloana MASCATĂ, null după
// anonimizare) pentru verificarea de ownership, în loc de `ownerId` (identitatea reală). Fail-safe din
// întâmplare pe detalii anonimizate (authorId mereu null → FORBIDDEN pentru oricine), dar contrazicea
// invarianta explicită a codebase-ului. Fix-ul (authorId → ownerId) a scos însă la iveală o gaură nouă:
// fără verificare EXPLICITĂ pe `isAnonymized`, fostul autor (al cărui ownerId rămâne neschimbat) ar
// trece din nou verificarea de ownership pe un detaliu din care s-a retras — testat mai jos.

const repo = vi.hoisted(() => ({
  getDetailById: vi.fn(),
  updateDetailRow: vi.fn(),
  getDetailResources: vi.fn(),
  replaceDetailResources: vi.fn(),
  replaceDetailCategories: vi.fn(),
}));

vi.mock("@/server/repos/detailsRepo", () => ({
  ...repo,
  deleteDetailCascade: vi.fn(),
  deleteSavedDetail: vi.fn(),
  getDetailForEdit: vi.fn(),
  anonymizeDetailAuthor: vi.fn(),
  countDetailInteractions: vi.fn(),
  incrementDetailViews: vi.fn(),
  insertDetailWithRelations: vi.fn(),
  insertSavedDetail: vi.fn(),
  isDetailSavedByUser: vi.fn(),
  listDetailDraftsByAuthor: vi.fn(),
  listFeed: vi.fn(),
  listTopDebated: vi.fn(),
  listRelatedDetails: vi.fn(),
  listSavedDetailIds: vi.fn(),
  listOfferedDetails: vi.fn(),
  listSavedDetails: vi.fn(),
  publishDetailRow: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ listTopAuthors: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/categoriesRepo", () => ({ countExistingCategoryIds: vi.fn() }));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
const { canAccessProjectDetail } = vi.hoisted(() => ({ canAccessProjectDetail: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail }));

import { updateDetail } from "./detailService";

const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DETAIL = "11111111-1111-4111-8111-111111111111";

const baseInput = {
  detailId: DETAIL,
  userId: AUTHOR,
  title: "Detaliu",
  categoryIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
  imageUrl: "https://blob/img.webp",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateDetail — autorizare (SEC-001 / SEC-002 regression)", () => {
  it("alt user decât ownerId → FORBIDDEN, fără query/update ulterior", async () => {
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: AUTHOR,
      isAnonymized: false,
    } as never);

    const res = await updateDetail({ ...baseInput, userId: OTHER });

    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(repo.updateDetailRow).not.toHaveBeenCalled();
  });

  it("detaliu anonimizat → FORBIDDEN chiar pentru fostul autor (ownerId încă potrivește)", async () => {
    // authorId mascat = null (cum ar veni din detailWithAuthorColumns pe un rând anonimizat), dar
    // ownerId rămâne identitatea reală — exact scenariul care ar fi trecut fals verificarea veche.
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: null,
      isAnonymized: true,
    } as never);

    const res = await updateDetail({ ...baseInput, userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(repo.updateDetailRow).not.toHaveBeenCalled();
  });

  it("proprietarul real, detaliu NEanonimizat → trece de poarta de ownership", async () => {
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: AUTHOR,
      isAnonymized: false,
      imageUrl: baseInput.imageUrl,
    } as never);
    const { countExistingCategoryIds } = await import("@/server/repos/categoriesRepo");
    vi.mocked(countExistingCategoryIds).mockResolvedValue(baseInput.categoryIds.length as never);
    repo.updateDetailRow.mockResolvedValue(undefined as never);
    repo.getDetailResources.mockResolvedValue([] as never);
    repo.replaceDetailResources.mockResolvedValue(undefined as never);
    repo.replaceDetailCategories.mockResolvedValue(undefined as never);

    const res = await updateDetail({ ...baseInput, userId: AUTHOR });

    expect(res.ok).toBe(true);
    expect(repo.updateDetailRow).toHaveBeenCalled();
  });
});

// Proiecte (gol găsit la /code-review, 2026-08-09): ownership singur nu ajunge — un autor eliminat
// dintr-un proiect nu mai are voie să editeze detaliul, chiar dacă a rămas ownerId real.
describe("updateDetail — proiecte", () => {
  it("autor eliminat din proiect → NOT_FOUND (anti-enumerare), fără update", async () => {
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: AUTHOR,
      isAnonymized: false,
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValue(false);

    const res = await updateDetail({ ...baseInput, userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(repo.updateDetailRow).not.toHaveBeenCalled();
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: AUTHOR });
  });

  it("autor tot membru activ al proiectului → merge normal", async () => {
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: AUTHOR,
      isAnonymized: false,
      projectId: "proj-1",
      imageUrl: baseInput.imageUrl,
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValue(true);
    const { countExistingCategoryIds } = await import("@/server/repos/categoriesRepo");
    vi.mocked(countExistingCategoryIds).mockResolvedValue(baseInput.categoryIds.length as never);
    repo.updateDetailRow.mockResolvedValue(undefined as never);
    repo.getDetailResources.mockResolvedValue([] as never);
    repo.replaceDetailResources.mockResolvedValue(undefined as never);
    repo.replaceDetailCategories.mockResolvedValue(undefined as never);

    const res = await updateDetail({ ...baseInput, userId: AUTHOR });

    expect(res.ok).toBe(true);
  });
});
