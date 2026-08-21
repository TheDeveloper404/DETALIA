import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-N01 (audit securitate 2026-08-20): o resursă (IMAGE/PDF/CAD) cu URL din store-ul nostru de Blob
// dar care aparține unui ALT user permitea unui atacator să atașeze URL-ul victimei pe propriul
// detaliu; la ștergerea acelui detaliu, `deleteBlobs` (filtrat doar pe store, nu pe proprietar) ștergea
// fișierul victimei din Blob — ștergere cross-user, fără rol special, fără precondiție. Fix:
// `hasForeignBlobResource` respinge orice resursă al cărei URL e din store-ul nostru dar nu e sub
// namespace-ul userului curent (`/u/<userId>/...`), la TOATE punctele de intrare care persistă resurse.

const repo = vi.hoisted(() => ({
  insertDetailWithRelations: vi.fn(),
  updateDetailRow: vi.fn(),
  getDetailById: vi.fn(),
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
vi.mock("@/server/repos/categoriesRepo", () => ({
  countExistingCategoryIds: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({
  canAccessProjectDetail: vi.fn(),
  getProjectAccess: vi.fn(),
}));

import { createDetail, updateDetail } from "./detailService";

const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DETAIL = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWN_IMAGE = `https://store.public.blob.vercel-storage.com/u/${AUTHOR}/details/img.webp`;
const VICTIM_IMAGE = `https://store.public.blob.vercel-storage.com/u/${OTHER}/avatars/x.webp`;

beforeEach(() => {
  vi.clearAllMocks();
  repo.insertDetailWithRelations.mockResolvedValue({ id: DETAIL } as never);
});

describe("createDetail — resurse din Blob-ul altui user (SEC-N01)", () => {
  it("respinge o resursă (PDF) al cărei URL e Blob-ul VICTIMEI, fără inserare", async () => {
    const res = await createDetail({
      authorId: AUTHOR,
      title: "Detaliu",
      categoryIds: [CATEGORY],
      imageUrl: OWN_IMAGE,
      resources: [{ type: "PDF", url: VICTIM_IMAGE }],
    });

    expect(res).toEqual({ ok: false, error: "INVALID_RESOURCE" });
    expect(repo.insertDetailWithRelations).not.toHaveBeenCalled();
  });

  it("acceptă o resursă din PROPRIUL namespace de Blob", async () => {
    const ownPdf = `https://store.public.blob.vercel-storage.com/u/${AUTHOR}/docs/x.pdf`;
    const res = await createDetail({
      authorId: AUTHOR,
      title: "Detaliu",
      categoryIds: [CATEGORY],
      imageUrl: OWN_IMAGE,
      resources: [{ type: "PDF", url: ownPdf }],
    });

    expect(res).toEqual({ ok: true, detailId: DETAIL });
    expect(repo.insertDetailWithRelations).toHaveBeenCalled();
  });

  it("acceptă un link extern (non-Blob) pe o resursă PDF/LINK — feature de produs, nu afectat de fix", async () => {
    const res = await createDetail({
      authorId: AUTHOR,
      title: "Detaliu",
      categoryIds: [CATEGORY],
      imageUrl: OWN_IMAGE,
      resources: [{ type: "LINK", url: "https://normativ.example.com/p100-1.pdf" }],
    });

    expect(res).toEqual({ ok: true, detailId: DETAIL });
  });
});

describe("updateDetail — resurse din Blob-ul altui user (SEC-N01)", () => {
  beforeEach(() => {
    repo.getDetailById.mockResolvedValue({
      id: DETAIL,
      ownerId: AUTHOR,
      authorId: AUTHOR,
      isAnonymized: false,
      imageUrl: OWN_IMAGE,
    } as never);
    repo.getDetailResources.mockResolvedValue([] as never);
  });

  it("respinge o resursă (CAD) al cărei URL e Blob-ul VICTIMEI, fără update", async () => {
    const res = await updateDetail({
      detailId: DETAIL,
      userId: AUTHOR,
      title: "Detaliu",
      categoryIds: [CATEGORY],
      imageUrl: OWN_IMAGE,
      resources: [{ type: "CAD", url: VICTIM_IMAGE }],
    });

    expect(res).toEqual({ ok: false, error: "INVALID_RESOURCE" });
    expect(repo.updateDetailRow).not.toHaveBeenCalled();
    expect(repo.replaceDetailResources).not.toHaveBeenCalled();
  });
});
