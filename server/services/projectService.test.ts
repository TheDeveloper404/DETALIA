import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/invite-token", () => ({
  generateInviteToken: vi.fn(() => "new-token-abc"),
  isInviteTokenExpired: vi.fn(() => false),
}));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn(), uploadProjectCanvasShare: vi.fn() }));
// Spy, nu mock complet — audit() rulează real (console.log, best-effort), doar urmărim apelurile.
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return { ...actual, audit: vi.fn(actual.audit) };
});
vi.mock("@/server/repos/detailsRepo", () => ({
  deleteDetailCascade: vi.fn(),
  listAllProjectDetails: vi.fn(),
  listProjectDetails: vi.fn(),
  listReleasedProjectDetails: vi.fn(),
}));
vi.mock("@/server/repos/plansaRepo", () => ({ getCanvasById: vi.fn() }));
vi.mock("@/server/repos/projectCanvasSharesRepo", () => ({
  countCanvasSharesByProject: vi.fn(() => Promise.resolve(0)),
  deleteCanvasShare: vi.fn(),
  getCanvasShareById: vi.fn(),
  insertCanvasShare: vi.fn(),
  listCanvasSharesByProject: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/server/repos/projectMembersRepo", () => ({
  countActiveMembers: vi.fn(() => Promise.resolve(0)),
  getMembership: vi.fn(),
  isActiveMember: vi.fn(),
  listActiveMembers: vi.fn(),
  removeMembership: vi.fn(),
  upsertActiveMembership: vi.fn(),
}));
vi.mock("@/server/repos/projectsRepo", () => ({
  countProjectsOwnedBy: vi.fn(() => Promise.resolve(0)),
  deleteProject: vi.fn(),
  getProjectById: vi.fn(),
  getProjectByInviteToken: vi.fn(),
  insertProject: vi.fn(),
  listProjectsForUser: vi.fn(),
  listProjectsOwnedBy: vi.fn(() => Promise.resolve([])),
  transferProjectOwnership: vi.fn(),
  updateInviteToken: vi.fn(),
  updateProjectName: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getUserWithRole: vi.fn(() => Promise.resolve(null)) }));

import { audit } from "@/lib/audit";
import { deleteBlobs, uploadProjectCanvasShare } from "@/lib/storage";
import { generateInviteToken, isInviteTokenExpired } from "@/lib/invite-token";
import {
  deleteDetailCascade,
  listAllProjectDetails,
  listProjectDetails,
} from "@/server/repos/detailsRepo";
import { getCanvasById } from "@/server/repos/plansaRepo";
import {
  countCanvasSharesByProject,
  deleteCanvasShare as deleteCanvasShareRow,
  getCanvasShareById,
  insertCanvasShare,
} from "@/server/repos/projectCanvasSharesRepo";
import {
  countActiveMembers,
  isActiveMember,
  listActiveMembers,
  removeMembership,
  upsertActiveMembership,
} from "@/server/repos/projectMembersRepo";
import {
  countProjectsOwnedBy,
  deleteProject as deleteProjectRow,
  getProjectById,
  getProjectByInviteToken,
  insertProject,
  listProjectsOwnedBy,
  transferProjectOwnership,
  updateInviteToken,
  updateProjectName,
} from "@/server/repos/projectsRepo";

import {
  canAccessProjectDetail,
  canReleaseDetailToCommunity,
  createProject,
  deleteCanvasShareForUser,
  deleteProject,
  getProject,
  getProjectAccess,
  getProjectForViewer,
  getProjectPreviewByToken,
  joinProjectByToken,
  reassignOrDeleteOwnedProjectsOnAccountDeletion,
  regenerateInviteLink,
  removeMember,
  renameProject,
  shareCanvasToProject,
} from "./projectService";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "owner-1";
// UUID valid — removeMember validează targetUserId cu isUuid (SEC-11).
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const STRANGER_ID = "stranger-1";
// Fix, nu `new Date()` la fiecare apel — două invocări projectRow() (una la mock, una la `toEqual`
// din test) ar produce milisecunde diferite și un fail flaky (SEC-006, `inviteTokenCreatedAt`).
const FIXED_NOW = new Date("2026-08-11T00:00:00.000Z");

function projectRow(
  overrides: Partial<{
    id: string;
    ownerId: string;
    name: string;
    inviteToken: string;
    inviteTokenCreatedAt: Date;
  }> = {},
) {
  return {
    id: PROJECT_ID,
    ownerId: OWNER_ID,
    name: "Renovare bloc A",
    inviteToken: "tok-abc",
    inviteTokenCreatedAt: FIXED_NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProject", () => {
  it("nume gol → EMPTY, nu atinge DB-ul", async () => {
    const res = await createProject({ ownerId: OWNER_ID, name: "" });
    expect(res).toEqual({ ok: false, error: "EMPTY" });
    expect(insertProject).not.toHaveBeenCalled();
  });

  it("nume valid → inserează cu un token generat, întoarce id + token", async () => {
    vi.mocked(insertProject).mockResolvedValueOnce(
      projectRow({ name: "Renovare bloc A", inviteToken: "new-token-abc" }) as never,
    );
    const res = await createProject({ ownerId: OWNER_ID, name: "  Renovare bloc A  " });
    expect(generateInviteToken).toHaveBeenCalled();
    expect(insertProject).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      name: "Renovare bloc A",
      inviteToken: "new-token-abc",
    });
    expect(res).toEqual({ ok: true, projectId: PROJECT_ID, inviteToken: "new-token-abc" });
  });

  // SEC-010 (audit securitate 2026-08-11): plafon de proiecte per owner — anti-abuz.
  it("owner-ul a atins plafonul de proiecte → LIMIT_REACHED, fără insert", async () => {
    vi.mocked(countProjectsOwnedBy).mockResolvedValueOnce(50);
    const res = await createProject({ ownerId: OWNER_ID, name: "Alt proiect" });
    expect(res).toEqual({ ok: false, error: "LIMIT_REACHED" });
    expect(insertProject).not.toHaveBeenCalled();
  });
});

describe("renameProject — DOAR owner", () => {
  it("id ne-UUID → NOT_FOUND, fără query", async () => {
    const res = await renameProject({ projectId: "not-a-uuid", requesterId: OWNER_ID, name: "X" });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("proiect inexistent → NOT_FOUND", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(null as never);
    const res = await renameProject({ projectId: PROJECT_ID, requesterId: OWNER_ID, name: "X" });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("nu ești owner (membru sau străin) → FORBIDDEN, fără scriere", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await renameProject({ projectId: PROJECT_ID, requesterId: MEMBER_ID, name: "X" });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(updateProjectName).not.toHaveBeenCalled();
  });

  it("owner, nume gol → EMPTY, fără scriere", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await renameProject({ projectId: PROJECT_ID, requesterId: OWNER_ID, name: "   " });
    expect(res).toEqual({ ok: false, error: "EMPTY" });
    expect(updateProjectName).not.toHaveBeenCalled();
  });

  it("owner, nume valid → redenumește, trimmed", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await renameProject({ projectId: PROJECT_ID, requesterId: OWNER_ID, name: "  Nume nou  " });
    expect(res).toEqual({ ok: true });
    expect(updateProjectName).toHaveBeenCalledWith(PROJECT_ID, "Nume nou");
  });
});

describe("getProjectAccess — poarta de acces", () => {
  it("proiect inexistent → totul fals", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(null as never);
    const res = await getProjectAccess({ projectId: PROJECT_ID, userId: STRANGER_ID });
    expect(res).toEqual({ isOwner: false, isActiveMember: false, hasAccess: false });
  });

  it("owner → acces, FĂRĂ să mai verifice tabelul de membri (owner nu are neapărat rând acolo)", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await getProjectAccess({ projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ isOwner: true, isActiveMember: false, hasAccess: true });
    expect(isActiveMember).not.toHaveBeenCalled();
  });

  it("membru activ, nu owner → acces", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    const res = await getProjectAccess({ projectId: PROJECT_ID, userId: MEMBER_ID });
    expect(res).toEqual({ isOwner: false, isActiveMember: true, hasAccess: true });
  });

  it("nici owner, nici membru activ → refuz", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(false);
    const res = await getProjectAccess({ projectId: PROJECT_ID, userId: STRANGER_ID });
    expect(res).toEqual({ isOwner: false, isActiveMember: false, hasAccess: false });
  });
});

describe("canAccessProjectDetail — SINGURUL punct de control pentru vizibilitatea de proiect", () => {
  it("deleagă la getProjectAccess.hasAccess", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    expect(await canAccessProjectDetail({ projectId: PROJECT_ID, userId: OWNER_ID })).toBe(true);

    vi.mocked(getProjectById).mockResolvedValueOnce(null as never);
    expect(await canAccessProjectDetail({ projectId: PROJECT_ID, userId: STRANGER_ID })).toBe(false);
  });
});

describe("getProjectForViewer — anti-enumerare", () => {
  it("fără acces → null (aceeași formă ca la proiect inexistent)", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(null as never);
    expect(await getProjectForViewer(PROJECT_ID, STRANGER_ID)).toBeNull();
  });

  it("cu acces → project + members + isOwner", async () => {
    vi.mocked(getProjectById)
      .mockResolvedValueOnce(projectRow() as never) // getProjectAccess
      .mockResolvedValueOnce(projectRow() as never); // getProjectById direct
    vi.mocked(listActiveMembers).mockResolvedValueOnce([{ id: "m1", userId: MEMBER_ID }] as never);

    const res = await getProjectForViewer(PROJECT_ID, OWNER_ID);
    expect(res).toEqual({
      project: projectRow(),
      members: [{ id: "m1", userId: MEMBER_ID }],
      owner: null,
      isOwner: true,
    });
  });

  // SEC-004 (audit securitate 2026-08-11): tokenul de invitație era vizibil oricărui membru prin DTO-ul
  // întors aici, apărat doar de gardă în UI (page.tsx) — bug-ul reparat azi. Poarta trebuie să fie AICI.
  it("membru (nu owner) → inviteToken este null, indiferent ce face UI-ul cu el", async () => {
    vi.mocked(getProjectById)
      .mockResolvedValueOnce(projectRow() as never) // getProjectAccess
      .mockResolvedValueOnce(projectRow() as never); // getProjectById direct
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([{ id: "m1", userId: MEMBER_ID }] as never);

    const res = await getProjectForViewer(PROJECT_ID, MEMBER_ID);
    expect(res).toEqual({
      project: { ...projectRow(), inviteToken: null },
      members: [{ id: "m1", userId: MEMBER_ID }],
      owner: null,
      isOwner: false,
    });
  });
});

describe("joinProjectByToken", () => {
  it("token invalid/inexistent → INVALID_TOKEN, nu inserează membru", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(null as never);
    const res = await joinProjectByToken({ token: "ghicit", userId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(upsertActiveMembership).not.toHaveBeenCalled();
  });

  it("token valid → membership upsert (idempotent și pt re-alăturare)", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    const res = await joinProjectByToken({ token: "tok-abc", userId: MEMBER_ID });
    expect(upsertActiveMembership).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(res).toEqual({ ok: true, projectId: PROJECT_ID, projectName: "Renovare bloc A" });
  });

  // SEC-010 (audit securitate 2026-08-11): plafon de membri per proiect — anti-abuz.
  it("proiect la plafonul de membri, user NOU → LIMIT_REACHED, fără upsert", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(false);
    vi.mocked(countActiveMembers).mockResolvedValueOnce(100);
    const res = await joinProjectByToken({ token: "tok-abc", userId: STRANGER_ID });
    expect(res).toEqual({ ok: false, error: "LIMIT_REACHED" });
    expect(upsertActiveMembership).not.toHaveBeenCalled();
  });

  it("proiect la plafonul de membri, DAR userul e deja membru activ → re-alăturarea trece (idempotent)", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    const res = await joinProjectByToken({ token: "tok-abc", userId: MEMBER_ID });
    expect(res).toEqual({ ok: true, projectId: PROJECT_ID, projectName: "Renovare bloc A" });
    expect(countActiveMembers).not.toHaveBeenCalled();
    expect(upsertActiveMembership).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
  });

  // SEC-006 (audit securitate 2026-08-11): token expirat (TTL 3 zile) = tratat identic cu token
  // inexistent — anti-enumerare, nu se distinge "expirat" de "n-a existat niciodată".
  it("token expirat → INVALID_TOKEN, nu inserează membru", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isInviteTokenExpired).mockReturnValueOnce(true);
    const res = await joinProjectByToken({ token: "tok-abc", userId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(upsertActiveMembership).not.toHaveBeenCalled();
  });
});

describe("getProjectPreviewByToken", () => {
  it("token valid → previzualizare (id + nume)", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    const res = await getProjectPreviewByToken("tok-abc");
    expect(res).toEqual({ id: PROJECT_ID, name: "Renovare bloc A" });
  });

  it("token expirat → null, la fel ca token inexistent", async () => {
    vi.mocked(getProjectByInviteToken).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(isInviteTokenExpired).mockReturnValueOnce(true);
    const res = await getProjectPreviewByToken("tok-abc");
    expect(res).toBeNull();
  });
});

describe("removeMember — DOAR owner", () => {
  it("proiect inexistent → NOT_FOUND", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(null as never);
    const res = await removeMember({ projectId: PROJECT_ID, requesterId: OWNER_ID, targetUserId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("requester NU e owner → FORBIDDEN, nu elimină pe nimeni", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await removeMember({ projectId: PROJECT_ID, requesterId: MEMBER_ID, targetUserId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(removeMembership).not.toHaveBeenCalled();
  });

  it("owner elimină un membru → ok", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await removeMember({ projectId: PROJECT_ID, requesterId: OWNER_ID, targetUserId: MEMBER_ID });
    expect(removeMembership).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(res).toEqual({ ok: true });
  });
});

describe("regenerateInviteLink — DOAR owner", () => {
  it("requester NU e owner → FORBIDDEN, nu regenerează", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await regenerateInviteLink({ projectId: PROJECT_ID, requesterId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(updateInviteToken).not.toHaveBeenCalled();
  });

  it("owner → token nou, suprascrie vechiul", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await regenerateInviteLink({ projectId: PROJECT_ID, requesterId: OWNER_ID });
    expect(updateInviteToken).toHaveBeenCalledWith(PROJECT_ID, "new-token-abc");
    expect(res).toEqual({ ok: true, inviteToken: "new-token-abc" });
  });
});

describe("deleteProject — DOAR owner", () => {
  beforeEach(() => {
    vi.mocked(listAllProjectDetails).mockResolvedValue([] as never);
    vi.mocked(deleteDetailCascade).mockResolvedValue([] as never);
  });

  it("requester NU e owner → FORBIDDEN, nu șterge", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await deleteProject({ projectId: PROJECT_ID, requesterId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(deleteProjectRow).not.toHaveBeenCalled();
    expect(deleteDetailCascade).not.toHaveBeenCalled();
  });

  it("owner → șterge proiectul", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await deleteProject({ projectId: PROJECT_ID, requesterId: OWNER_ID });
    expect(deleteProjectRow).toHaveBeenCalledWith(PROJECT_ID);
    expect(res).toEqual({ ok: true });
  });

  // Gol găsit la /code-review (2026-08-09): ștergerea se baza doar pe cascada de FK, care NU atinge
  // validările/comentariile (polimorfice, fără FK) și nici fișierele din Blob.
  it("fiecare detaliu din proiect trece prin cascada completă, nu doar prin FK", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(listAllProjectDetails).mockResolvedValue([
      { id: "detail-1", imageUrl: "blob://d1.webp" },
      { id: "detail-2", imageUrl: null },
    ] as never);
    vi.mocked(deleteDetailCascade)
      .mockResolvedValueOnce(["blob://thumb-1.png"] as never)
      .mockResolvedValueOnce(["blob://resursa.pdf", "blob://comentariu.webp"] as never);

    const res = await deleteProject({ projectId: PROJECT_ID, requesterId: OWNER_ID });

    expect(res).toEqual({ ok: true });
    expect(deleteDetailCascade).toHaveBeenCalledWith("detail-1");
    expect(deleteDetailCascade).toHaveBeenCalledWith("detail-2");
    // Toate fișierele — thumbnail-uri, resurse, poze din comentarii ȘI imaginea detaliului însuși.
    expect(deleteBlobs).toHaveBeenCalledWith([
      "blob://thumb-1.png",
      "blob://d1.webp",
      "blob://resursa.pdf",
      "blob://comentariu.webp",
      null,
    ]);
  });

  it("detaliile se șterg ÎNAINTE de rândul proiectului", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    vi.mocked(listAllProjectDetails).mockResolvedValue([
      { id: "detail-1", imageUrl: null },
    ] as never);
    const order: string[] = [];
    vi.mocked(deleteDetailCascade).mockImplementation(async () => {
      order.push("cascade");
      return [];
    });
    vi.mocked(deleteProjectRow).mockImplementation(async () => {
      order.push("project");
    });

    await deleteProject({ projectId: PROJECT_ID, requesterId: OWNER_ID });

    expect(order).toEqual(["cascade", "project"]);
  });

  it("proiect fără detalii → nu apelează cascada degeaba", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow() as never);
    const res = await deleteProject({ projectId: PROJECT_ID, requesterId: OWNER_ID });
    expect(deleteDetailCascade).not.toHaveBeenCalled();
    expect(deleteProjectRow).toHaveBeenCalledWith(PROJECT_ID);
    expect(res).toEqual({ ok: true });
  });
});

describe("canReleaseDetailToCommunity — regula «orfan», parte DB", () => {
  it("autorul detaliului cere → allowed, indiferent de restul", async () => {
    const res = await canReleaseDetailToCommunity({
      projectId: PROJECT_ID,
      detailAuthorId: MEMBER_ID,
      projectOwnerId: OWNER_ID,
      requesterId: MEMBER_ID,
    });
    expect(res).toEqual({ allowed: true });
  });

  it("autorul detaliului E owner-ul proiectului → allowed prin isDetailAuthor, fără query de membru", async () => {
    // autorul == owner → e cazul „autorul cere", nu regula orfan
    const res = await canReleaseDetailToCommunity({
      projectId: PROJECT_ID,
      detailAuthorId: OWNER_ID,
      projectOwnerId: OWNER_ID,
      requesterId: OWNER_ID,
    });
    expect(res).toEqual({ allowed: true });
    expect(isActiveMember).not.toHaveBeenCalled();
  });

  it("owner cere pe detaliul ALTCUIVA, autorul ÎNCĂ membru activ → refuz (nu e moderare)", async () => {
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    const res = await canReleaseDetailToCommunity({
      projectId: PROJECT_ID,
      detailAuthorId: MEMBER_ID,
      projectOwnerId: OWNER_ID,
      requesterId: OWNER_ID,
    });
    expect(isActiveMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(res).toEqual({ allowed: false, error: "FORBIDDEN" });
  });

  it("owner cere pe detaliul unui autor care NU mai e membru activ → allowed (detaliu orfan)", async () => {
    vi.mocked(isActiveMember).mockResolvedValueOnce(false);
    const res = await canReleaseDetailToCommunity({
      projectId: PROJECT_ID,
      detailAuthorId: MEMBER_ID,
      projectOwnerId: OWNER_ID,
      requesterId: OWNER_ID,
    });
    expect(res).toEqual({ allowed: true });
  });

  it("un membru oarecare (nici autor, nici owner) → refuz", async () => {
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    const res = await canReleaseDetailToCommunity({
      projectId: PROJECT_ID,
      detailAuthorId: MEMBER_ID,
      projectOwnerId: OWNER_ID,
      requesterId: STRANGER_ID,
    });
    expect(res).toEqual({ allowed: false, error: "FORBIDDEN" });
  });
});

// SEC-11 (2026-08-09, gol găsit la /code-review): un projectId malformat trebuie tratat „nu există",
// niciodată lăsat să lovească Postgres direct (eroare 22P02 pe coloana uuid → 500 în loc de notFound()).
describe("SEC-11 — projectId malformat → «nu există», fără query pe DB", () => {
  it("getProjectAccess: id ne-UUID → totul fals, fără getProjectById", async () => {
    const res = await getProjectAccess({ projectId: "not-a-uuid", userId: OWNER_ID });
    expect(res).toEqual({ isOwner: false, isActiveMember: false, hasAccess: false });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("removeMember: id ne-UUID → NOT_FOUND, fără query", async () => {
    const res = await removeMember({ projectId: "not-a-uuid", requesterId: OWNER_ID, targetUserId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  // gol găsit la /code-review, 2026-08-09: targetUserId nu era validat cu isUuid, spre deosebire de
  // orice alt id din acest fișier — un targetUserId malformat lovea direct Postgres.
  it("removeMember: targetUserId ne-UUID → NOT_FOUND, fără query", async () => {
    const res = await removeMember({ projectId: PROJECT_ID, requesterId: OWNER_ID, targetUserId: "not-a-uuid" });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("deleteProject: id ne-UUID → NOT_FOUND, fără query", async () => {
    const res = await deleteProject({ projectId: "not-a-uuid", requesterId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("regenerateInviteLink: id ne-UUID → NOT_FOUND, fără query", async () => {
    const res = await regenerateInviteLink({ projectId: "not-a-uuid", requesterId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("getProject: id ne-UUID → null, fără query", async () => {
    expect(await getProject("not-a-uuid")).toBeNull();
    expect(getProjectById).not.toHaveBeenCalled();
  });
});

const CANVAS_ID = "44444444-4444-4444-8444-444444444444";
const SHARE_ID = "55555555-5555-4555-8555-555555555555";

function canvasRow(overrides: Partial<{ id: string; ownerId: string; name: string; thumbnailUrl: string | null }> = {}) {
  return {
    id: CANVAS_ID,
    ownerId: OWNER_ID,
    name: "Planșa mea",
    // SEC-07: trebuie să treacă `isOwnBlobUrl` (formă reală de Blob), altfel guard-ul nou respinge
    // fixture-ul înainte să apuce să testeze restul fluxului.
    thumbnailUrl: "https://abc123.public.blob.vercel-storage.com/thumb.png",
    ...overrides,
  };
}

describe("shareCanvasToProject — IDOR: owner planșă + membru proiect, ambele obligatorii", () => {
  it("planșă a altcuiva → NOT_FOUND (anti-enumerare), fără verificare de acces la proiect", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow({ ownerId: STRANGER_ID }) as never);
    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it("planșă proprie, dar NU membru al proiectului → FORBIDDEN", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow() as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: STRANGER_ID }) as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(false);
    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(insertCanvasShare).not.toHaveBeenCalled();
  });

  it("planșă fără thumbnail (nesalvată încă) → EMPTY_CANVAS", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow({ thumbnailUrl: null }) as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "EMPTY_CANVAS" });
  });

  // SEC-07 (audit 2026-08-22): gardă defensivă nouă — `thumbnailUrl` nu vine azi din client (scris
  // exclusiv server-side), dar dacă vreodată ar veni, un URL din afara store-ului nostru trebuie refuzat
  // ÎNAINTE de fetch (aliniat cu restul fetch-urilor server-side de blob).
  it("thumbnailUrl dintr-un domeniu care NU e store-ul nostru de Blob → UPLOAD_FAILED, fără fetch", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(
      canvasRow({ thumbnailUrl: "https://evil.com/fake-thumb.png" }) as never,
    );
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "UPLOAD_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("planșă proprie + membru activ → partajează, cu numele planșei + dată în titlu", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow() as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }),
    );
    vi.mocked(uploadProjectCanvasShare).mockResolvedValueOnce({ ok: true, url: "https://blob/share.png" });
    vi.mocked(insertCanvasShare).mockResolvedValueOnce({ id: SHARE_ID } as never);

    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });

    expect(res).toEqual({ ok: true, shareId: SHARE_ID });
    expect(insertCanvasShare).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        sharedByUserId: OWNER_ID,
        imageUrl: "https://blob/share.png",
        name: expect.stringContaining("Planșa mea"),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("proiect șters concurent între verificarea de acces și insert → NOT_FOUND, nu excepție", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow() as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }),
    );
    vi.mocked(uploadProjectCanvasShare).mockResolvedValueOnce({ ok: true, url: "https://blob/share.png" });
    const fkError = Object.assign(new Error("insert or update on table violates foreign key constraint"), {
      code: "23503",
    });
    vi.mocked(insertCanvasShare).mockRejectedValueOnce(fkError);

    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    vi.unstubAllGlobals();
  });

  // SEC-010 (audit securitate 2026-08-11): plafon de partajări per proiect — anti-abuz (fiecare
  // partajare consumă un blob full-size nou, plătit).
  it("proiect la plafonul de partajări → LIMIT_REACHED, fără upload/insert", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce(canvasRow() as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(countCanvasSharesByProject).mockResolvedValueOnce(100);
    const res = await shareCanvasToProject({ canvasId: CANVAS_ID, projectId: PROJECT_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "LIMIT_REACHED" });
    expect(insertCanvasShare).not.toHaveBeenCalled();
  });
});

describe("deleteCanvasShareForUser — cine a partajat SAU owner-ul proiectului, nimeni altcineva", () => {
  function shareRow(overrides: Partial<{ id: string; projectId: string; sharedByUserId: string; imageUrl: string }> = {}) {
    return { id: SHARE_ID, projectId: PROJECT_ID, sharedByUserId: MEMBER_ID, imageUrl: "https://blob/share.png", ...overrides };
  }

  it("share inexistent → NOT_FOUND", async () => {
    vi.mocked(getCanvasShareById).mockResolvedValueOnce(null as never);
    const res = await deleteCanvasShareForUser({ shareId: SHARE_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(deleteCanvasShareRow).not.toHaveBeenCalled();
  });

  it("un alt membru al proiectului (nici sharer, nici owner) → FORBIDDEN", async () => {
    vi.mocked(getCanvasShareById).mockResolvedValueOnce(shareRow() as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    const res = await deleteCanvasShareForUser({ shareId: SHARE_ID, userId: STRANGER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(deleteCanvasShareRow).not.toHaveBeenCalled();
  });

  it("cel care a partajat-o, ÎNCĂ membru activ → poate șterge, blob-ul se curăță", async () => {
    vi.mocked(getCanvasShareById).mockResolvedValueOnce(shareRow({ sharedByUserId: MEMBER_ID }) as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(true);
    vi.mocked(deleteCanvasShareRow).mockResolvedValueOnce("https://blob/share.png");
    const res = await deleteCanvasShareForUser({ shareId: SHARE_ID, userId: MEMBER_ID });
    expect(res).toEqual({ ok: true, projectId: PROJECT_ID });
    expect(deleteBlobs).toHaveBeenCalledWith(["https://blob/share.png"]);
  });

  // SEC-009 (audit securitate 2026-08-11): citirea era deja închisă la eliminare din proiect, dar
  // scrierea pe conținutul propriu (ștergerea propriei partajări) rămăsese deschisă — inconsecvență
  // a graniței, reparată azi.
  it("cel care a partajat-o, DAR eliminat între timp din proiect → FORBIDDEN, nu doar sharer-ul contează", async () => {
    vi.mocked(getCanvasShareById).mockResolvedValueOnce(shareRow({ sharedByUserId: MEMBER_ID }) as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(isActiveMember).mockResolvedValueOnce(false);
    const res = await deleteCanvasShareForUser({ shareId: SHARE_ID, userId: MEMBER_ID });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(deleteCanvasShareRow).not.toHaveBeenCalled();
  });

  it("owner-ul proiectului (nu sharer) → poate șterge (moderare)", async () => {
    vi.mocked(getCanvasShareById).mockResolvedValueOnce(shareRow({ sharedByUserId: MEMBER_ID }) as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(deleteCanvasShareRow).mockResolvedValueOnce("https://blob/share.png");
    const res = await deleteCanvasShareForUser({ shareId: SHARE_ID, userId: OWNER_ID });
    expect(res).toEqual({ ok: true, projectId: PROJECT_ID });
  });
});

// SEC-013 (audit securitate 2026-08-11, decizie de produs): ștergere cont (GDPR) — proiecte deținute de
// userul șters. Decis: proiect cu ALȚI membri activi ȘI CU CONT ACTIV → transfer AUTOMAT către cel mai
// vechi (nu se întreabă userul, nu există pas suplimentar); fără candidat eligibil → proiectul se
// șterge odată cu contul.
function activeMemberRow(
  overrides: Partial<{ userId: string; joinedAt: Date; status: "ACTIVE" | "SUSPENDED" | "DELETED" }> = {},
) {
  return {
    id: `m-${overrides.userId ?? "x"}`,
    userId: MEMBER_ID,
    joinedAt: new Date(),
    name: "Membru",
    image: null,
    roleMain: null,
    subRole: null,
    verified: false,
    status: "ACTIVE" as const,
    ...overrides,
  };
}

describe("reassignOrDeleteOwnedProjectsOnAccountDeletion", () => {
  it("fără proiecte deținute → no-op", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([]);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).not.toHaveBeenCalled();
    expect(deleteProjectRow).not.toHaveBeenCalled();
  });

  it("proiect cu alți membri activi → transfer către cel mai vechi (primul din listActiveMembers)", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: MEMBER_ID }),
      activeMemberRow({ userId: STRANGER_ID }),
    ] as never);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(deleteProjectRow).not.toHaveBeenCalled();
  });

  // /code-review QODO (2026-08-11): owner-ul poate avea propriul rând în project_members (s-a alăturat
  // prin propriul link) — transferul schimba DOAR ownerId, rândul vechi rămânea activ → membru-fantomă.
  it("la transfer, elimină și rândul de membru al vechiului owner (dacă exista)", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: OWNER_ID }),
      activeMemberRow({ userId: MEMBER_ID }),
    ] as never);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(removeMembership).toHaveBeenCalledWith(PROJECT_ID, OWNER_ID);
  });

  // /code-review QODO (2026-08-11): bucla nu izola erorile — un proiect care aruncă oprea reasignarea
  // TUTUROR celorlalte proiecte deținute. Verificăm că al doilea proiect e procesat oricum.
  it("un proiect care aruncă NU oprește procesarea celorlalte proiecte deținute", async () => {
    const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222229";
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([
      { id: PROJECT_ID },
      { id: OTHER_PROJECT_ID },
    ] as never);
    vi.mocked(listActiveMembers).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listActiveMembers).mockResolvedValueOnce([activeMemberRow({ userId: MEMBER_ID })] as never);

    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);

    expect(transferProjectOwnership).toHaveBeenCalledTimes(1);
    expect(transferProjectOwnership).toHaveBeenCalledWith(OTHER_PROJECT_ID, MEMBER_ID);
  });

  it("proiect fără alți membri activi (doar owner-ul, sau nimeni) → se șterge odată cu contul", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: OWNER_ID }),
    ] as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(listAllProjectDetails).mockResolvedValueOnce([]);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).not.toHaveBeenCalled();
    expect(deleteProjectRow).toHaveBeenCalledWith(PROJECT_ID);
  });

  // /code-review QODO round 2 (2026-08-11): deleteProject întoarce {ok:false} (nu aruncă) pe
  // NOT_FOUND/FORBIDDEN — fără verificare pe `result.ok`, audit-ul afirma "proiect șters" chiar și
  // când ștergerea n-a avut loc (ex. proiectul a fost deja șters concurent, altă filă deschisă).
  it("deleteProject eșuează (ex. proiect deja șters concurent) → NU se auditează ca 'șters'", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: OWNER_ID }),
    ] as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(null as never); // deleteProject → NOT_FOUND
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(deleteProjectRow).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalledWith("project_deleted_on_account_deletion", expect.anything());
  });

  // /code-review (2026-08-11): găsit — fără filtru pe status, un membru cu rând `removedAt = null` dar
  // cont deja DELETED (ștergerea altui cont nu curăță membership-urile din proiectele altora) putea
  // deveni owner permanent, needevoalabil. Cel mai vechi e un cont-fantomă → sărit, se alege următorul
  // membru cu adevărat ACTIVE.
  it("cel mai vechi membru are contul șters/suspendat → sărit, se alege următorul membru ACTIV", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: "ghost-user", status: "DELETED" }),
      activeMemberRow({ userId: STRANGER_ID, status: "ACTIVE" }),
    ] as never);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).toHaveBeenCalledWith(PROJECT_ID, STRANGER_ID);
  });

  it("TOȚI ceilalți membri au contul șters/suspendat → niciun candidat eligibil, proiectul se șterge", async () => {
    vi.mocked(listProjectsOwnedBy).mockResolvedValueOnce([{ id: PROJECT_ID }] as never);
    vi.mocked(listActiveMembers).mockResolvedValueOnce([
      activeMemberRow({ userId: "ghost-1", status: "DELETED" }),
      activeMemberRow({ userId: "ghost-2", status: "SUSPENDED" }),
    ] as never);
    vi.mocked(getProjectById).mockResolvedValueOnce(projectRow({ ownerId: OWNER_ID }) as never);
    vi.mocked(listAllProjectDetails).mockResolvedValueOnce([]);
    await reassignOrDeleteOwnedProjectsOnAccountDeletion(OWNER_ID);
    expect(transferProjectOwnership).not.toHaveBeenCalled();
    expect(deleteProjectRow).toHaveBeenCalledWith(PROJECT_ID);
  });
});
