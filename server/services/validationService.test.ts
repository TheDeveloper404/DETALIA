import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/commentsRepo", () => ({ insertComment: vi.fn() }));
vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({ getSketchById: vi.fn() }));
vi.mock("@/server/repos/validationsRepo", () => ({
  deletePosition: vi.fn(),
  listPositionsForTarget: vi.fn(),
  listUserPositionsForTargets: vi.fn(),
  upsertDisapprovalIfTransition: vi.fn(),
  upsertPosition: vi.fn(),
}));

import { insertComment } from "@/server/repos/commentsRepo";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { upsertDisapprovalIfTransition, upsertPosition } from "@/server/repos/validationsRepo";

import { approve, disapprove, recordSketchDisapproval } from "./validationService";

const ROLE = { roleMain: "EXECUTANT", subRole: null, verificationStatus: "UNVERIFIED" };
const target = {
  userId: "u-1",
  targetType: "DETAIL" as const,
  targetId: "22222222-2222-4222-8222-222222222222",
  detailId: "22222222-2222-4222-8222-222222222222",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue(ROLE as never);
  vi.mocked(getDetailById).mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222", authorId: "x", title: "T" } as never);
  vi.mocked(upsertPosition).mockResolvedValue({ id: "v-1" } as never);
  vi.mocked(upsertDisapprovalIfTransition).mockResolvedValue({ id: "v-1" } as never);
});

describe("rol declarat obligatoriu — poziția „cântărește” prin rol", () => {
  it("approve fără rol → NO_ROLE", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
    expect(await approve(target)).toEqual({ ok: false, error: "NO_ROLE" });
    expect(upsertPosition).not.toHaveBeenCalled();
  });

  it("disapprove fără rol → NO_ROLE", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
    expect(await disapprove({ ...target, justification: "motiv" })).toEqual({
      ok: false,
      error: "NO_ROLE",
    });
  });
});

describe("„nu există dezaprobare mută” — justificarea e obligatorie", () => {
  it("disapprove fără justificare → JUSTIFICATION_REQUIRED, fără scriere", async () => {
    const r = await disapprove({ ...target, justification: "   " });
    expect(r).toEqual({ ok: false, error: "JUSTIFICATION_REQUIRED" });
    expect(upsertDisapprovalIfTransition).not.toHaveBeenCalled();
    expect(insertComment).not.toHaveBeenCalled();
  });

  it("disapprove nou → tranziție atomică + comentariu-justificare exact o dată", async () => {
    const r = await disapprove({ ...target, justification: "  nu rezistă la îngheț  " });
    expect(r).toEqual({ ok: true });
    expect(upsertDisapprovalIfTransition).toHaveBeenCalledTimes(1);
    expect(insertComment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertComment).mock.calls[0][0]).toMatchObject({
      body: "nu rezistă la îngheț", // trimmed
      originValidationId: "v-1",
    });
  });

  // Acoperă și race-ul dublu-submit: repo-ul întoarce null când poziția era DEJA DISAPPROVE
  // (decis atomic în DB, nu prin read-then-write) → a doua cerere nu mai creează comentariu.
  // Bug găsit 2026-07-14: înainte se răspundea `{ ok: true }` aici, deci userul primea „succes"
  // fals fără să știe că justificarea lui nouă nu a fost salvată nicăieri.
  it("re-dezaprobare / cerere paralelă pierzătoare (tranziție null) → ALREADY_DISAPPROVED, NU dublează comentariul", async () => {
    vi.mocked(upsertDisapprovalIfTransition).mockResolvedValue(null as never);
    const r = await disapprove({ ...target, justification: "iar nu merge" });
    expect(r).toEqual({ ok: false, error: "ALREADY_DISAPPROVED" });
    expect(insertComment).not.toHaveBeenCalled();
  });
});

describe("SEC-11 — targetId malformat → TARGET_NOT_FOUND, fără atingere DB", () => {
  it("approve cu targetId ne-UUID → TARGET_NOT_FOUND, fără getDetailById/upsert", async () => {
    const r = await approve({ ...target, targetId: "not-a-uuid" });
    expect(r).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(getDetailById).not.toHaveBeenCalled();
    expect(upsertPosition).not.toHaveBeenCalled();
  });
});

describe("approve = 1 click", () => {
  it("cu rol + țintă existentă → upsert APPROVE", async () => {
    const r = await approve(target);
    expect(r).toEqual({ ok: true });
    expect(vi.mocked(upsertPosition).mock.calls[0][0]).toMatchObject({ position: "APPROVE" });
  });
});

describe("nu te validezi pe propriul conținut — CANNOT_VALIDATE_OWN (enforce pe server)", () => {
  beforeEach(() => {
    // Autorul țintei = userul care votează.
    vi.mocked(getDetailById).mockResolvedValue({ id: target.targetId, authorId: target.userId, title: "T" } as never);
  });

  it("approve pe propriul detaliu → CANNOT_VALIDATE_OWN, fără upsert", async () => {
    const r = await approve(target);
    expect(r).toEqual({ ok: false, error: "CANNOT_VALIDATE_OWN" });
    expect(upsertPosition).not.toHaveBeenCalled();
  });

  it("disapprove pe propriul detaliu → CANNOT_VALIDATE_OWN, fără upsert/comentariu", async () => {
    const r = await disapprove({ ...target, justification: "motiv valid" });
    expect(r).toEqual({ ok: false, error: "CANNOT_VALIDATE_OWN" });
    expect(upsertDisapprovalIfTransition).not.toHaveBeenCalled();
    expect(insertComment).not.toHaveBeenCalled();
  });
});

describe("recordSketchDisapproval — materializarea dezaprobării la publicarea schiței", () => {
  it("autorul schiței ≠ autorul detaliului → tranziție DISAPPROVE + comentariu auto", async () => {
    vi.mocked(getDetailById).mockResolvedValue({ id: target.targetId, authorId: "owner-x", title: "T" } as never);
    await recordSketchDisapproval({ userId: target.userId, detailId: target.targetId });
    expect(upsertDisapprovalIfTransition).toHaveBeenCalledTimes(1);
    expect(insertComment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertComment).mock.calls[0][0]).toMatchObject({ originValidationId: "v-1" });
  });

  it("dublu-publish / dezaprobare deja existentă (tranziție null) → fără comentariu dublu", async () => {
    vi.mocked(getDetailById).mockResolvedValue({ id: target.targetId, authorId: "owner-x", title: "T" } as never);
    vi.mocked(upsertDisapprovalIfTransition).mockResolvedValue(null as never);
    await recordSketchDisapproval({ userId: target.userId, detailId: target.targetId });
    expect(insertComment).not.toHaveBeenCalled();
  });

  it("autorul-mamă schițează pe propriul detaliu → no-op (nu se auto-dezaprobă)", async () => {
    vi.mocked(getDetailById).mockResolvedValue({ id: target.targetId, authorId: target.userId, title: "T" } as never);
    await recordSketchDisapproval({ userId: target.userId, detailId: target.targetId });
    expect(upsertDisapprovalIfTransition).not.toHaveBeenCalled();
    expect(insertComment).not.toHaveBeenCalled();
  });
});
