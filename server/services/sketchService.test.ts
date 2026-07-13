import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock-uim TOATE repo-urile (fără DB) + notificările + validationService + storage.
// Testăm doar authz/state machine/atomicitate din service.
vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({
  getSketchById: vi.fn(),
  insertDraft: vi.fn(),
  deleteDraftByAuthor: vi.fn(),
  deleteSketchCascade: vi.fn(),
  listDraftsByAuthor: vi.fn(),
  listPublishedByDetail: vi.fn(),
  publishFromDraft: vi.fn(),
  updateStrokes: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({
  notifySketchProposed: vi.fn(),
  notifySketchDeleted: vi.fn(),
}));
vi.mock("@/server/services/validationService", () => ({ recordSketchDisapproval: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { deleteBlobs } from "@/lib/storage";
import { getDetailById } from "@/server/repos/detailsRepo";
import {
  deleteSketchCascade,
  getSketchById,
  publishFromDraft,
} from "@/server/repos/sketchesRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import {
  notifySketchDeleted,
  notifySketchProposed,
} from "@/server/services/notificationService";
import { recordSketchDisapproval } from "@/server/services/validationService";

import { deleteSketch, getDraftForEdit, publish, saveStrokes } from "./sketchService";

const OWNER = "owner-1"; // autorul detaliului-mamă
const SKETCH_AUTHOR = "sketcher-1"; // autorul schiței
const ATTACKER = "attacker-1";
const SID = "11111111-1111-4111-8111-111111111111";
const DID = "22222222-2222-4222-8222-222222222222";

const validStrokes = [{ color: "#211d18", size: 8, points: [[0.1, 0.2]], kind: "free" }];

function draft(over: Record<string, unknown> = {}) {
  return {
    id: SID,
    detailId: DID,
    authorId: SKETCH_AUTHOR,
    status: "DRAFT",
    strokesJson: validStrokes,
    disapprovesParent: false,
    thumbnailUrl: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDetailById).mockResolvedValue({ id: DID, authorId: OWNER, title: "T" } as never);
  vi.mocked(getNotificationActor).mockResolvedValue({
    name: "X",
    roleMain: "PROIECTANT",
    verification: "UNVERIFIED",
  } as never);
});

describe("IDOR — doar autorul schiței o poate atinge cât e DRAFT", () => {
  it("saveStrokes: alt user → FORBIDDEN", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await saveStrokes({ sketchId: SID, authorId: ATTACKER, strokes: validStrokes });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("getDraftForEdit: alt user → FORBIDDEN", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await getDraftForEdit(SID, ATTACKER);
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("publish: alt user → FORBIDDEN, fără tranziție/notificare", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    const r = await publish({ sketchId: SID, authorId: ATTACKER });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(publishFromDraft).not.toHaveBeenCalled();
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });
});

describe("SEC-11 — id malformat → not found, fără atingere DB", () => {
  it("publish cu sketchId ne-UUID → SKETCH_NOT_FOUND, fără query", async () => {
    const r = await publish({ sketchId: "not-a-uuid", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "SKETCH_NOT_FOUND" });
    expect(getSketchById).not.toHaveBeenCalled();
  });

  it("createDraft cu detailId ne-UUID → DETAIL_NOT_FOUND", async () => {
    const { createDraft } = await import("./sketchService");
    const r = await createDraft({ detailId: "x", authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "DETAIL_NOT_FOUND" });
  });
});

describe("PUBLISH — DRAFT → PUBLISHED, atomic + notificare o singură dată", () => {
  it("respinge dacă nu e DRAFT (state machine)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    const r = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
  });

  it("cursă pierdută (publishFromDraft=false) → INVALID_STATE, NU notifică (fără email dublu)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(publishFromDraft).mockResolvedValue(false as never);
    const r = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: false, error: "INVALID_STATE" });
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });

  it("succes → notifică autorul detaliului-mamă exact o dată; fără dezaprobare dacă nu e marcată", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    const r = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: true });
    expect(notifySketchProposed).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySketchProposed).mock.calls[0][0]).toMatchObject({ recipientUserId: OWNER });
    expect(recordSketchDisapproval).not.toHaveBeenCalled();
  });

  it("dezaprobare-prin-schiță (disapprovesParent) → materializează dezaprobarea pe detaliul-mamă", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ disapprovesParent: true }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    const r = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: true });
    expect(recordSketchDisapproval).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordSketchDisapproval).mock.calls[0][0]).toMatchObject({
      userId: SKETCH_AUTHOR,
      detailId: DID,
    });
  });
});

describe("DELETE — moderare post-publicare (autor schiță SAU autor detaliu)", () => {
  it("un străin nu poate șterge → FORBIDDEN, fără cascadă", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    const r = await deleteSketch({ sketchId: SID, actorUserId: ATTACKER });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(deleteSketchCascade).not.toHaveBeenCalled();
  });

  it("autorul schiței își șterge propria schiță → cascadă, FĂRĂ notificare", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    vi.mocked(deleteSketchCascade).mockResolvedValue("blob://thumb" as never);
    const r = await deleteSketch({ sketchId: SID, actorUserId: SKETCH_AUTHOR });
    expect(r).toEqual({ ok: true });
    expect(deleteSketchCascade).toHaveBeenCalledTimes(1);
    expect(deleteBlobs).toHaveBeenCalledWith(["blob://thumb"]);
    expect(notifySketchDeleted).not.toHaveBeenCalled();
  });

  it("autorul detaliului șterge schița altcuiva → cascadă + notifică autorul schiței", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    vi.mocked(deleteSketchCascade).mockResolvedValue(null as never);
    const r = await deleteSketch({ sketchId: SID, actorUserId: OWNER });
    expect(r).toEqual({ ok: true });
    expect(deleteSketchCascade).toHaveBeenCalledTimes(1);
    expect(notifySketchDeleted).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySketchDeleted).mock.calls[0][0]).toMatchObject({
      recipientUserId: SKETCH_AUTHOR,
    });
  });

  it("sketchId ne-UUID → SKETCH_NOT_FOUND, fără query", async () => {
    const r = await deleteSketch({ sketchId: "not-a-uuid", actorUserId: OWNER });
    expect(r).toEqual({ ok: false, error: "SKETCH_NOT_FOUND" });
    expect(getSketchById).not.toHaveBeenCalled();
  });
});
