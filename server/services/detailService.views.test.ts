import { describe, expect, it, vi } from "vitest";

const { incrementDetailViews } = vi.hoisted(() => ({ incrementDetailViews: vi.fn() }));

// Repo-ul e mock-uit integral: testăm regulile serviciului (guard pe id, izolarea erorilor),
// nu SQL-ul — incrementul atomic e responsabilitatea DB-ului.
vi.mock("@/server/repos/detailsRepo", () => ({
  incrementDetailViews,
  deleteDetailCascade: vi.fn(),
  deleteSavedDetail: vi.fn(),
  getDetailById: vi.fn(),
  getDetailForEdit: vi.fn(),
  getDetailResources: vi.fn(),
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
vi.mock("@/server/services/roleService", () => ({ userHasRole: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { recordDetailView } from "./detailService";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("recordDetailView", () => {
  it("incrementează contorul pentru un id valid", async () => {
    incrementDetailViews.mockResolvedValueOnce(undefined);

    await recordDetailView(VALID_ID);

    expect(incrementDetailViews).toHaveBeenCalledWith(VALID_ID);
  });

  it("ignoră un id malformat, fără să atingă DB-ul", async () => {
    incrementDetailViews.mockClear();

    await recordDetailView("nu-e-uuid");

    expect(incrementDetailViews).not.toHaveBeenCalled();
  });

  it("o eroare de DB NU se propagă — un contor de afișări nu are voie să strice pagina", async () => {
    incrementDetailViews.mockRejectedValueOnce(new Error("connection lost"));

    await expect(recordDetailView(VALID_ID)).resolves.toBeUndefined();
  });
});
