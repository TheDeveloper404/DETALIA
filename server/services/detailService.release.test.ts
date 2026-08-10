import { beforeEach, describe, expect, it, vi } from "vitest";

// Fișier NOU — releaseDetailToCommunity nu avea acoperire unitară (gol semnalat la /code-review,
// 2026-08-09). Scop îngust: regula „orfan" (autorul poate scoate detaliul chiar eliminat din proiect).
const { getDetailById } = vi.hoisted(() => ({ getDetailById: vi.fn() }));
const { releaseDetailToCommunityRow } = vi.hoisted(() => ({ releaseDetailToCommunityRow: vi.fn() }));
const { getProject, canReleaseDetailToCommunity } = vi.hoisted(() => ({
  getProject: vi.fn(),
  canReleaseDetailToCommunity: vi.fn(),
}));

vi.mock("@/server/repos/detailsRepo", () => ({
  getDetailById,
  releaseDetailToCommunity: releaseDetailToCommunityRow,
}));
vi.mock("@/server/services/projectService", () => ({
  getProject,
  canReleaseDetailToCommunity,
  // celelalte funcții din serviciu, referite de alte funcții ale detailService.ts (neapelate aici):
  canAccessProjectDetail: vi.fn(),
  getProjectAccess: vi.fn(),
}));

import { releaseDetailToCommunity } from "./detailService";

const DETAIL_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR = "author-1";
const OWNER = "owner-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("releaseDetailToCommunity — regula orfan", () => {
  it("autorul detaliului, ELIMINAT între timp din proiect, tot poate scoate detaliul în comunitate", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: AUTHOR,
      projectId: PROJECT_ID,
    } as never);
    vi.mocked(getProject).mockResolvedValue({ id: PROJECT_ID, ownerId: OWNER } as never);
    vi.mocked(canReleaseDetailToCommunity).mockResolvedValue({ allowed: true } as never);

    const res = await releaseDetailToCommunity({ detailId: DETAIL_ID, userId: AUTHOR });

    expect(res).toEqual({ ok: true, projectId: PROJECT_ID });
    // SEC-002 (2026-08-10): release publică doar conținutul autorului — repo-ul primește authorId ca
    // să poată marca `hiddenAfterRelease` pe schițele altor membri, atomic cu nularea projectId.
    expect(releaseDetailToCommunityRow).toHaveBeenCalledWith(DETAIL_ID, AUTHOR);
  });

  it("un membru oarecare (nu autor, nu owner) → FORBIDDEN, fără scriere", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: AUTHOR,
      projectId: PROJECT_ID,
    } as never);
    vi.mocked(getProject).mockResolvedValue({ id: PROJECT_ID, ownerId: OWNER } as never);
    vi.mocked(canReleaseDetailToCommunity).mockResolvedValue({ allowed: false, error: "FORBIDDEN" } as never);

    const res = await releaseDetailToCommunity({ detailId: DETAIL_ID, userId: "someone-else" });

    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(releaseDetailToCommunityRow).not.toHaveBeenCalled();
  });

  it("detaliul nu e într-un proiect → NOT_IN_PROJECT", async () => {
    vi.mocked(getDetailById).mockResolvedValue({ id: DETAIL_ID, ownerId: AUTHOR, projectId: null } as never);

    const res = await releaseDetailToCommunity({ detailId: DETAIL_ID, userId: AUTHOR });

    expect(res).toEqual({ ok: false, error: "NOT_IN_PROJECT" });
  });
});
