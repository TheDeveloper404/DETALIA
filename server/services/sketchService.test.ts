import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock-uim TOATE repo-urile (fără DB) + notificările. Testăm doar authz/state machine/atomicitate din service.
vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({
  getSketchById: vi.fn(),
  insertDraft: vi.fn(),
  deleteDraftByAuthor: vi.fn(),
  listDraftsByAuthor: vi.fn(),
  listPendingByDetail: vi.fn(),
  listPublishedByDetail: vi.fn(),
  listRecentPublished: vi.fn(),
  transitionFromDraft: vi.fn(),
  transitionFromPending: vi.fn(),
  updateStrokes: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({
  notifySketchProposed: vi.fn(),
  notifySketchDecision: vi.fn(),
}));

import { getDetailById } from "@/server/repos/detailsRepo";
import {
  getSketchById,
  transitionFromDraft,
  transitionFromPending,
} from "@/server/repos/sketchesRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import {
  notifySketchDecision,
  notifySketchProposed,
} from "@/server/services/notificationService";

import { accept, getDraftForEdit, reject, saveStrokes, send } from "./sketchService";

const OWNER = "owner-1"; // autorul detaliului-mamă
const SKETCH_AUTHOR = "sketcher-1"; // autorul schiței
const ATTACKER = "attacker-1";

const validStrokes = [{ color: "#211d18", size: 8, points: [[0.1, 0.2]], kind: "free" }];

function draft(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    detailId: "22222222-2222-4222-8222-222222222222",
    authorId: SKETCH_AUTHOR,
    status: "DRAFT",
    strokesJson: validStrokes,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDetailById).mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222", authorId: OWNER, title: "T" } as never);
  vi.mocked(getNotificationActor).mockResolvedValue({
    name: "X",
    roleMain: "PROIECTANT",
    verification: "UNVERIFIED",
  } as never);
});

describe("IDOR — doar autorul schiței o poate atinge cât e DRAFT", () => {
  it("saveStrokes: alt user → FORBIDDEN", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await saveStrokes({ sketchId: "11111111-1111-4111-8111-111111111111", authorId: ATTACKER, strokes: validStrokes });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("getDraftForEdit: alt user → FORBIDDEN", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await getDraftForEdit("11111111-1111-4111-8111-111111111111", ATTACKER);
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("send: alt user → FORBIDDEN, fără tranziție/notificare", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await send({ sketchId: "11111111-1111-4111-8111-111111111111", authorId: ATTACKER });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(transitionFromDraft).not.toHaveBeenCalled();
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });
});

describe("SEC-11 — id malformat → not found, fără atingere DB", () => {
  it("send cu sketchId ne-UUID → SKETCH_NOT_FOUND, fără query", async () => {
    const r = await send({ sketchId: "not-a-uuid", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "SKETCH_NOT_FOUND" });
    expect(getSketchById).not.toHaveBeenCalled();
  });

  it("createDraft cu detailId ne-UUID → DETAIL_NOT_FOUND", async () => {
    const { createDraft } = await import("./sketchService");
    const r = await createDraft({ detailId: "x", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "DETAIL_NOT_FOUND" });
  });
});

describe("SEND — DRAFT → PENDING, atomic + notificare o singură dată", () => {
  it("respinge dacă nu e DRAFT (state machine)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PENDING_ACCEPTANCE" }) as never);
    const r = await send({ sketchId: "11111111-1111-4111-8111-111111111111", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
  });

  it("cursă pierdută (transitionFromDraft=false) → INVALID_STATE, NU notifică (fără email dublu)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(transitionFromDraft).mockResolvedValue(false as never);
    const r = await send({ sketchId: "11111111-1111-4111-8111-111111111111", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });

  it("succes → notifică autorul detaliului-mamă exact o dată", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(transitionFromDraft).mockResolvedValue(true as never);
    const r = await send({ sketchId: "11111111-1111-4111-8111-111111111111", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: true });
    expect(notifySketchProposed).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySketchProposed).mock.calls[0][0]).toMatchObject({
      recipientUserId: OWNER,
    });
  });
});

describe("ACCEPT/REJECT — doar autorul detaliului-mamă (IDOR) + atomic", () => {
  beforeEach(() => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PENDING_ACCEPTANCE" }) as never);
  });

  it("autorul schiței NU poate accepta propria schiță → FORBIDDEN", async () => {
    const r = await accept({ sketchId: "11111111-1111-4111-8111-111111111111", actorUserId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(transitionFromPending).not.toHaveBeenCalled();
  });

  it("un străin nu poate respinge → FORBIDDEN", async () => {
    const r = await reject({ sketchId: "11111111-1111-4111-8111-111111111111", actorUserId: ATTACKER });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("respinge dacă nu e PENDING (state machine)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    const r = await accept({ sketchId: "11111111-1111-4111-8111-111111111111", actorUserId: OWNER });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
  });

  it("cursă pierdută (transitionFromPending=false) → INVALID_STATE, fără notificare", async () => {
    vi.mocked(transitionFromPending).mockResolvedValue(false as never);
    const r = await accept({ sketchId: "11111111-1111-4111-8111-111111111111", actorUserId: OWNER });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
    expect(notifySketchDecision).not.toHaveBeenCalled();
  });

  it("accept reușit → tranziție la PUBLISHED + notificare către autorul schiței", async () => {
    vi.mocked(transitionFromPending).mockResolvedValue(true as never);
    const r = await accept({ sketchId: "11111111-1111-4111-8111-111111111111", actorUserId: OWNER });
    expect(r).toEqual({ ok: true });
    expect(vi.mocked(transitionFromPending).mock.calls[0][1]).toMatchObject({ status: "PUBLISHED" });
    expect(notifySketchDecision).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySketchDecision).mock.calls[0][0]).toMatchObject({
      recipientUserId: SKETCH_AUTHOR,
      accepted: true,
    });
  });
});
