import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  anonymizeDetailAuthor: vi.fn(),
  countDetailInteractions: vi.fn(),
  deleteDetailCascade: vi.fn(),
  getDetailById: vi.fn(),
}));

vi.mock("@/server/repos/detailsRepo", () => ({
  ...repo,
  deleteSavedDetail: vi.fn(),
  getDetailForEdit: vi.fn(),
  getDetailResources: vi.fn(),
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
  replaceDetailCategories: vi.fn(),
  replaceDetailResources: vi.fn(),
  updateDetailRow: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ listTopAuthors: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/categoriesRepo", () => ({ countExistingCategoryIds: vi.fn() }));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
const { canAccessProjectDetail } = vi.hoisted(() => ({ canAccessProjectDetail: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail }));

import { deleteBlobs } from "@/lib/storage";
import { getRoleByUserId } from "@/server/repos/rolesRepo";

import { deleteDetail, getDeletionPreview } from "./detailService";

const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DETAIL = "11111111-1111-4111-8111-111111111111";

const detailRow = {
  id: DETAIL,
  ownerId: AUTHOR,
  authorId: AUTHOR,
  isAnonymized: false,
  imageUrl: "https://blob/img.webp",
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.getDetailById.mockResolvedValue(detailRow as never);
  repo.deleteDetailCascade.mockResolvedValue([] as never);
  repo.anonymizeDetailAuthor.mockResolvedValue(true as never);
  vi.mocked(getRoleByUserId).mockResolvedValue({
    roleMain: "ARHITECT",
    subRole: "Structurist",
    verificationStatus: "VERIFIED",
  } as never);
});

// Proiecte (gol găsit la /code-review, 2026-08-09): vezi comentariul identic din updateDetail.
describe("deleteDetail — proiecte", () => {
  it("autor eliminat din proiect → NOT_FOUND (anti-enumerare), fără ștergere/anonimizare", async () => {
    repo.getDetailById.mockResolvedValue({ ...detailRow, projectId: "proj-1" } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValue(false);

    const res = await deleteDetail({ detailId: DETAIL, userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(repo.deleteDetailCascade).not.toHaveBeenCalled();
    expect(repo.anonymizeDetailAuthor).not.toHaveBeenCalled();
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: AUTHOR });
  });
});

describe("deleteDetail — detaliu FĂRĂ interacțiuni", () => {
  beforeEach(() => {
    repo.countDetailInteractions.mockResolvedValue({
      comments: 0,
      validations: 0,
      sketchesFromOthers: 0,
    } as never);
  });

  it("se șterge complet, cu tot cu fișiere", async () => {
    const res = await deleteDetail({ detailId: DETAIL, userId: AUTHOR });

    expect(res).toEqual({ ok: true, mode: "HARD_DELETE" });
    expect(repo.deleteDetailCascade).toHaveBeenCalledWith(DETAIL);
    expect(deleteBlobs).toHaveBeenCalled();
    expect(repo.anonymizeDetailAuthor).not.toHaveBeenCalled();
  });
});

describe("deleteDetail — detaliu CU interacțiuni", () => {
  beforeEach(() => {
    repo.countDetailInteractions.mockResolvedValue({
      comments: 2,
      validations: 0,
      sketchesFromOthers: 0,
    } as never);
  });

  it("NU se șterge nimic — se retrage doar identitatea autorului, cu rolul înghețat", async () => {
    const res = await deleteDetail({ detailId: DETAIL, userId: AUTHOR });

    expect(res).toEqual({ ok: true, mode: "ANONYMIZE", alreadyDone: false });
    expect(repo.deleteDetailCascade).not.toHaveBeenCalled();
    expect(deleteBlobs).not.toHaveBeenCalled();
    expect(repo.anonymizeDetailAuthor).toHaveBeenCalledWith(DETAIL, AUTHOR, {
      roleMain: "ARHITECT",
      subRole: "Structurist",
      verificationStatus: "VERIFIED",
    });
  });

  it("dublu-click / două file: a doua cerere nu rescrie snapshot-ul, raportează alreadyDone", async () => {
    repo.anonymizeDetailAuthor.mockResolvedValueOnce(false as never);

    const res = await deleteDetail({ detailId: DETAIL, userId: AUTHOR });

    expect(res).toEqual({ ok: true, mode: "ANONYMIZE", alreadyDone: true });
  });
});

describe("deleteDetail — autorizare (adversarial)", () => {
  beforeEach(() => {
    repo.countDetailInteractions.mockResolvedValue({
      comments: 0,
      validations: 0,
      sketchesFromOthers: 0,
    } as never);
  });

  it("alt user decât proprietarul → FORBIDDEN, fără să atingă nimic", async () => {
    const res = await deleteDetail({ detailId: DETAIL, userId: OTHER });

    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(repo.deleteDetailCascade).not.toHaveBeenCalled();
    expect(repo.anonymizeDetailAuthor).not.toHaveBeenCalled();
  });

  it("detaliu deja anonimizat → nici fostul autor nu-l mai poate șterge", async () => {
    repo.getDetailById.mockResolvedValue({ ...detailRow, isAnonymized: true, authorId: null } as never);

    const res = await deleteDetail({ detailId: DETAIL, userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "ALREADY_ANONYMIZED" });
    expect(repo.deleteDetailCascade).not.toHaveBeenCalled();
  });

  it("id malformat → NOT_FOUND, fără query", async () => {
    const res = await deleteDetail({ detailId: "nu-e-uuid", userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(repo.getDetailById).not.toHaveBeenCalled();
  });
});

describe("getDeletionPreview — ce promite dialogul înainte de click", () => {
  it("prezice ACELAȘI mod pe care îl execută ștergerea", async () => {
    repo.countDetailInteractions.mockResolvedValue({
      comments: 0,
      validations: 1,
      sketchesFromOthers: 0,
    } as never);

    await expect(getDeletionPreview({ detailId: DETAIL, userId: AUTHOR })).resolves.toEqual({
      mode: "ANONYMIZE",
    });
  });

  it("pentru cine nu e proprietar → null (nu dezvăluim nimic)", async () => {
    repo.countDetailInteractions.mockResolvedValue({
      comments: 0,
      validations: 0,
      sketchesFromOthers: 0,
    } as never);

    await expect(getDeletionPreview({ detailId: DETAIL, userId: OTHER })).resolves.toBeNull();
  });
});
