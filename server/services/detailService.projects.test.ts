import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDetailById,
  getDetailForEdit,
  getDetailResources,
  isDetailSavedByUser,
  insertSavedDetail,
  deleteSavedDetail,
} = vi.hoisted(() => ({
  getDetailById: vi.fn(),
  getDetailForEdit: vi.fn(),
  getDetailResources: vi.fn(),
  isDetailSavedByUser: vi.fn(),
  insertSavedDetail: vi.fn(),
  deleteSavedDetail: vi.fn(),
}));
const { canAccessProjectDetail, isDetailAuthorRemovedFromProject } = vi.hoisted(() => ({
  canAccessProjectDetail: vi.fn(),
  isDetailAuthorRemovedFromProject: vi.fn(),
}));

vi.mock("@/server/services/projectService", () => ({
  canAccessProjectDetail,
  isDetailAuthorRemovedFromProject,
}));

// Repo-ul e mock-uit integral: testăm regulile serviciului (poarta de acces la proiect), nu SQL-ul.
vi.mock("@/server/repos/detailsRepo", () => ({
  getDetailById,
  getDetailResources,
  isDetailSavedByUser,
  insertSavedDetail,
  deleteSavedDetail,
  deleteDetailCascade: vi.fn(),
  getDetailForEdit,
  insertDetailWithRelations: vi.fn(),
  listDetailDraftsByAuthor: vi.fn(),
  listFeed: vi.fn(),
  listTopDebated: vi.fn(),
  listRelatedDetails: vi.fn(),
  listSavedDetailIds: vi.fn(),
  listOfferedDetails: vi.fn(),
  listSavedDetails: vi.fn(),
  publishDetailRow: vi.fn(),
  releaseDetailToCommunity: vi.fn(),
  replaceDetailCategories: vi.fn(),
  replaceDetailResources: vi.fn(),
  updateDetailRow: vi.fn(),
  incrementDetailViews: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ listTopAuthors: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/categoriesRepo", () => ({ countExistingCategoryIds: vi.fn() }));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ shouldCountView: vi.fn() }));

import { getDetail, getDetailForEditing, toggleSavedDetail } from "./detailService";

const DETAIL_ID = "22222222-2222-4222-8222-222222222222";
const OWNER = "owner-1";
const MEMBER = "member-1";
const STRANGER = "stranger-1";

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DETAIL_ID,
    ownerId: OWNER,
    authorId: OWNER,
    title: "Detaliu proiect",
    isAnonymized: false,
    projectId: null as string | null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Proiecte (2026-08-09) — SINGURUL punct de control pentru citirea unui detaliu de proiect.
describe("getDetail — poarta de acces la proiect", () => {
  it("detaliu fără proiect → nu atinge canAccessProjectDetail deloc", async () => {
    vi.mocked(getDetailById).mockResolvedValueOnce(detailRow() as never);
    vi.mocked(getDetailResources).mockResolvedValueOnce([] as never);

    const res = await getDetail(DETAIL_ID, STRANGER);

    expect(res).not.toBeNull();
    expect(canAccessProjectDetail).not.toHaveBeenCalled();
  });

  it("detaliu de proiect, requester FĂRĂ acces → null (aceeași formă ca «nu există»)", async () => {
    vi.mocked(getDetailById).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getDetail(DETAIL_ID, STRANGER);

    expect(res).toBeNull();
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: STRANGER });
    expect(getDetailResources).not.toHaveBeenCalled();
  });

  it("detaliu de proiect, requester CU acces → randează normal", async () => {
    vi.mocked(getDetailById).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);
    vi.mocked(getDetailResources).mockResolvedValueOnce([] as never);

    const res = await getDetail(DETAIL_ID, MEMBER);

    expect(res).not.toBeNull();
  });
});

describe("toggleSavedDetail — proiecte, gol găsit la /code-review", () => {
  it("non-membru nu poate salva un detaliu de proiect (fără leak pe /saved)", async () => {
    vi.mocked(getDetailById).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await toggleSavedDetail({ userId: STRANGER, detailId: DETAIL_ID });

    expect(res).toEqual({ saved: false });
    expect(insertSavedDetail).not.toHaveBeenCalled();
    expect(isDetailSavedByUser).not.toHaveBeenCalled();
  });

  it("membru activ poate salva un detaliu de proiect", async () => {
    vi.mocked(getDetailById).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);
    vi.mocked(isDetailSavedByUser).mockResolvedValueOnce(false);

    const res = await toggleSavedDetail({ userId: MEMBER, detailId: DETAIL_ID });

    expect(res).toEqual({ saved: true });
    expect(insertSavedDetail).toHaveBeenCalledWith(MEMBER, DETAIL_ID);
  });
});

// Proiecte (gol găsit la /code-review, 2026-08-09): formularul de editare (/details/[id]/edit) folosea
// doar getDetailForEdit (scoped pe ownerId) — un autor eliminat din proiect tot vedea/putea încărca
// conținutul formularului, deși getDetail (citirea publică) îi refuza deja accesul.
describe("getDetailForEditing — poarta de acces la proiect", () => {
  it("autor eliminat din proiect → null (anti-enumerare, la fel ca getDetail)", async () => {
    vi.mocked(getDetailForEdit).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getDetailForEditing(DETAIL_ID, OWNER);

    expect(res).toBeNull();
    expect(getDetailResources).not.toHaveBeenCalled();
  });

  it("autor tot membru activ → formularul se încarcă normal", async () => {
    vi.mocked(getDetailForEdit).mockResolvedValueOnce(detailRow({ projectId: "proj-1" }) as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);
    vi.mocked(getDetailResources).mockResolvedValueOnce([] as never);

    const res = await getDetailForEditing(DETAIL_ID, OWNER);

    expect(res).not.toBeNull();
    expect(res?.id).toBe(DETAIL_ID);
  });
});
