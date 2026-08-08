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
  listAnnotationsByDetail: vi.fn(),
  countAnnotationsByDetail: vi.fn(),
  publishFromDraft: vi.fn(),
  updateStrokes: vi.fn(),
  filterPublishedSketchIds: vi.fn(),
  lockStackBases: vi.fn(),
  updateBaseSketchIds: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({
  notifySketchProposed: vi.fn(),
  notifySketchDeleted: vi.fn(),
}));
vi.mock("@/server/services/validationService", () => ({ recordSketchDisapproval: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { deleteBlobs } from "@/lib/storage";
import {
  MAX_ANNOTATIONS_PER_DETAIL,
  MAX_SKETCH_NOTE_LENGTH,
  MAX_STACK_DEPTH,
} from "@/server/domain/sketch";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  countAnnotationsByDetail,
  deleteSketchCascade,
  filterPublishedSketchIds,
  getSketchById,
  insertDraft,
  lockStackBases,
  publishFromDraft,
  updateBaseSketchIds,
  updateStrokes,
} from "@/server/repos/sketchesRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import {
  notifySketchDeleted,
  notifySketchProposed,
} from "@/server/services/notificationService";
import { recordSketchDisapproval } from "@/server/services/validationService";

import {
  createAnnotation,
  createDraft,
  deleteSketch,
  getDraftForEdit,
  publish,
  saveStrokes,
} from "./sketchService";

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
  // `ownerId` = proprietarul REAL al detaliului (nemascat de anonimizare) — serviciile de business
  // îl citesc pe ăsta, nu `authorId` (care e identitatea afișabilă, null după retragere).
  vi.mocked(getDetailById).mockResolvedValue({ id: DID, ownerId: OWNER, authorId: OWNER, title: "T" } as never);
  vi.mocked(getNotificationActor).mockResolvedValue({
    name: "X",
    roleMain: "PROIECTANT",
    verification: "UNVERIFIED",
  } as never);
  vi.mocked(countAnnotationsByDetail).mockResolvedValue(0);
  // Implicit: toate foile din rețeta stack-ului încă există (cazul normal). Testele de cursă
  // suprascriu ca să simuleze o foaie ștearsă între capturare și publicare.
  vi.mocked(filterPublishedSketchIds).mockImplementation(async (_detailId, ids) => ids);
});

// Un detaliu poate avea până la MAX_ANNOTATIONS_PER_DETAIL adnotări (decizie 2026-08-02). Fiecare
// „Schițează peste" al AUTORULUI pe propriul detaliu începe una NOUĂ, de la zero; cele existente rămân
// neatinse (se corectează prin ștergere + desenare din nou). Plafonul se impune pe server, în `publish`.
describe("Adnotări multiple — fiecare începe de la zero, cu plafon pe server", () => {
  it("AUTORUL, cu adnotări existente → draftul pornește GOL (nu continuă adnotarea veche)", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ main: "PROIECTANT" } as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(1);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);

    await createDraft({ detailId: DID, authorId: OWNER });

    expect(insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: OWNER, strokesJson: null }),
    );
  });

  it("AUTORUL la plafon → createDraft refuză, fără să deschidă un editor inutil", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ main: "PROIECTANT" } as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(MAX_ANNOTATIONS_PER_DETAIL);

    const res = await createDraft({ detailId: DID, authorId: OWNER });

    expect(res).toEqual({ ok: false, error: "ANNOTATION_LIMIT" });
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it("ALT user nu e limitat de plafonul de adnotări (teancul e alt concept)", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ main: "PROIECTANT" } as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(MAX_ANNOTATIONS_PER_DETAIL);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);

    const res = await createDraft({ detailId: DID, authorId: SKETCH_AUTHOR });

    expect(res.ok).toBe(true);
    expect(countAnnotationsByDetail).not.toHaveBeenCalled();
    expect(insertDraft).toHaveBeenCalledWith(expect.objectContaining({ strokesJson: null }));
  });

  it("publicarea NU mai șterge adnotările existente (se acumulează, nu se înlocuiesc)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(1);

    const res = await publish({ sketchId: SID, authorId: OWNER });

    expect(res.ok).toBe(true);
    expect(deleteSketchCascade).not.toHaveBeenCalled();
    expect(deleteBlobs).not.toHaveBeenCalled();
    // Adnotarea nu e o contribuție primită → autorul nu se anunță pe sine.
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });

  it("publish la plafon → ANNOTATION_LIMIT, FĂRĂ tranziție (draftul rămâne draft)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(MAX_ANNOTATIONS_PER_DETAIL);

    const res = await publish({ sketchId: SID, authorId: OWNER });

    expect(res).toEqual({ ok: false, error: "ANNOTATION_LIMIT" });
    expect(publishFromDraft).not.toHaveBeenCalled();
  });

  it("publish sub plafon (2 din 3) → trece", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    vi.mocked(countAnnotationsByDetail).mockResolvedValue(MAX_ANNOTATIONS_PER_DETAIL - 1);

    const res = await publish({ sketchId: SID, authorId: OWNER });

    expect(res.ok).toBe(true);
  });

  it("schița ALTUIA nu e supusă plafonului și nu atinge adnotările autorului", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);

    await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(countAnnotationsByDetail).not.toHaveBeenCalled();
    expect(deleteSketchCascade).not.toHaveBeenCalled();
  });

  it("AUTORUL își poate ȘTERGE propria adnotare (singura cale de a scăpa de ea)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(
      draft({ authorId: OWNER, status: "PUBLISHED" }) as never,
    );
    vi.mocked(deleteSketchCascade).mockResolvedValue("https://blob/annotation.png" as never);

    const res = await deleteSketch({ sketchId: SID, actorUserId: OWNER });

    expect(res.ok).toBe(true);
    expect(deleteSketchCascade).toHaveBeenCalledWith(SID);
    expect(deleteBlobs).toHaveBeenCalledWith(["https://blob/annotation.png"]);
    // Ștergerea propriei adnotări nu notifică pe nimeni — nu e moderarea muncii altcuiva.
    expect(notifySketchDeleted).not.toHaveBeenCalled();
  });
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

  // ADNOTARE (2026-07-31): autorul schițează pe PROPRIUL detaliu → destinatarul notificării ar fi chiar
  // el. Nu se auto-notifică; restul publicării (tranziția) rămâne identică.
  it("adnotare (autorul pe propriul detaliu) → publică, dar NU se auto-notifică", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    const r = await publish({ sketchId: SID, authorId: OWNER });
    expect(r).toEqual({ ok: true });
    expect(publishFromDraft).toHaveBeenCalledTimes(1);
    expect(notifySketchProposed).not.toHaveBeenCalled();
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

// ADNOTAREA autorului creată într-un pas la publicarea detaliului (formularul /details/new).
describe("createAnnotation — doar autorul își adnotează propriul detaliu", () => {
  it("alt user decât autorul detaliului → FORBIDDEN, nu se creează nimic", async () => {
    const r = await createAnnotation({ detailId: DID, authorId: ATTACKER, strokes: validStrokes });
    expect(r).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it("detailId care nu e uuid → DETAIL_NOT_FOUND, fără atingerea DB-ului (SEC-11)", async () => {
    const r = await createAnnotation({ detailId: "../../etc", authorId: OWNER, strokes: validStrokes });
    expect(r).toEqual({ ok: false, error: "DETAIL_NOT_FOUND" });
    expect(getDetailById).not.toHaveBeenCalled();
  });

  // Ordinea contează: validăm ÎNAINTE de insert, altfel rămâne o ciornă goală orfană în „Ciornele mele".
  it("stroke-uri invalide → respinse ÎNAINTE de a se crea ciorna", async () => {
    const r = await createAnnotation({ detailId: DID, authorId: OWNER, strokes: "nu e listă" });
    expect(r.ok).toBe(false);
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it("autorul detaliului → creează ciorna și o publică direct, fără auto-notificare", async () => {
    // `createDraft` cere rol declarat (poartă de business moștenită) — fără el iese NO_ROLE.
    vi.mocked(getRoleByUserId).mockResolvedValue({ roleMain: "PROIECTANT" } as never);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
    const r = await createAnnotation({ detailId: DID, authorId: OWNER, strokes: validStrokes });
    expect(r).toEqual({ ok: true, value: { sketchId: SID } });
    expect(publishFromDraft).toHaveBeenCalledTimes(1);
    expect(notifySketchProposed).not.toHaveBeenCalled();
  });

  // Nota scrisă a adnotării, adăugată în formularul de publicare 2026-08-02. Se persistă odată cu
  // stroke-urile (`updateStrokes`), trecută prin `validateSketchNote` — trim, nu text brut de la client.
  it("nota adnotării ajunge validată în DB, nu brută de la client", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ roleMain: "PROIECTANT" } as never);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);

    const r = await createAnnotation({
      detailId: DID,
      authorId: OWNER,
      strokes: validStrokes,
      note: "  săgeata arată sensul de scurgere  ",
    });

    expect(r.ok).toBe(true);
    expect(updateStrokes).toHaveBeenCalledWith(
      SID,
      validStrokes,
      "săgeata arată sensul de scurgere",
    );
  });

  it("notă peste limita de lungime → NOTE_TOO_LONG, adnotarea nu se publică", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ roleMain: "PROIECTANT" } as never);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);
    vi.mocked(getSketchById).mockResolvedValue(draft({ authorId: OWNER }) as never);

    const r = await createAnnotation({
      detailId: DID,
      authorId: OWNER,
      strokes: validStrokes,
      note: "x".repeat(MAX_SKETCH_NOTE_LENGTH + 1),
    });

    expect(r).toEqual({ ok: false, error: "NOTE_TOO_LONG" });
    expect(publishFromDraft).not.toHaveBeenCalled();
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

  // Regresie (găsit la /code-review, 2026-08-06): moderarea trebuie să folosească `ownerId`
  // (proprietarul REAL), nu `authorId` (mascat de anonimizare → null pe un detaliu retras). Cu
  // `authorId`, autorul unui detaliu anonimizat pierdea dreptul de a-și modera propriile schițe.
  it("detaliu ANONIMIZAT (authorId mascat = null) → autorul REAL tot poate modera (folosind ownerId)", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DID,
      ownerId: OWNER,
      authorId: null,
      isAnonymized: true,
      title: "T",
    } as never);
    vi.mocked(getSketchById).mockResolvedValue(draft({ status: "PUBLISHED" }) as never);
    vi.mocked(deleteSketchCascade).mockResolvedValue(null as never);

    const r = await deleteSketch({ sketchId: SID, actorUserId: OWNER });

    expect(r).toEqual({ ok: true });
    expect(deleteSketchCascade).toHaveBeenCalledTimes(1);
  });
});

// ── Stack de foi (2026-08-08) ────────────────────────────────────────────────────────────────────
// „Schițează peste" îngheață foile aprinse pe ecran ca fundal al noii schițe. Rețeta vine din CLIENT,
// deci serverul o tratează ca input ostil: validare structurală + confruntare cu DB-ul.
describe("Stack — capturarea rețetei la createDraft", () => {
  const BASE_A = "aaaaaaaa-1111-4111-8111-111111111111";
  const BASE_B = "bbbbbbbb-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ main: "PROIECTANT" } as never);
    vi.mocked(insertDraft).mockResolvedValue({ id: SID } as never);
  });

  it("fără rețetă → schiță pornită de pe detaliul gol (comportamentul de dinainte)", async () => {
    await createDraft({ detailId: DID, authorId: SKETCH_AUTHOR });

    expect(insertDraft).toHaveBeenCalledWith(expect.objectContaining({ baseSketchIds: [] }));
  });

  it("rețetă validă → se persistă în ordinea primită (jos → sus)", async () => {
    await createDraft({ detailId: DID, authorId: SKETCH_AUTHOR, baseSketchIds: [BASE_A, BASE_B] });

    expect(insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({ baseSketchIds: [BASE_A, BASE_B] }),
    );
  });

  it("ADVERSARIAL — id-uri de pe ALT detaliu sunt eliminate (nu randăm conținut străin)", async () => {
    // DB-ul confirmă doar una din cele două foi ca aparținând acestui detaliu.
    vi.mocked(filterPublishedSketchIds).mockResolvedValue([BASE_A]);

    await createDraft({ detailId: DID, authorId: SKETCH_AUTHOR, baseSketchIds: [BASE_A, BASE_B] });

    expect(filterPublishedSketchIds).toHaveBeenCalledWith(DID, [BASE_A, BASE_B]);
    expect(insertDraft).toHaveBeenCalledWith(expect.objectContaining({ baseSketchIds: [BASE_A] }));
  });

  it("ADVERSARIAL — rețetă malformată → refuz, fără să se creeze ciornă", async () => {
    const res = await createDraft({
      detailId: DID,
      authorId: SKETCH_AUTHOR,
      baseSketchIds: ["nu-i-uuid"],
    });

    expect(res).toEqual({ ok: false, error: "INVALID_STACK" });
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it("ADVERSARIAL — stack peste plafon → refuz, fără să se creeze ciornă", async () => {
    const tooMany = Array.from(
      { length: MAX_STACK_DEPTH + 1 },
      (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );

    const res = await createDraft({
      detailId: DID,
      authorId: SKETCH_AUTHOR,
      baseSketchIds: tooMany,
    });

    expect(res).toEqual({ ok: false, error: "STACK_TOO_DEEP" });
    expect(insertDraft).not.toHaveBeenCalled();
  });

  it("ADNOTAREA autorului ignoră stack-ul activ — pornește mereu de pe detaliul gol", async () => {
    // OWNER desenează pe PROPRIUL detaliu, dintr-un tab cu foi aprinse.
    await createDraft({ detailId: DID, authorId: OWNER, baseSketchIds: [BASE_A, BASE_B] });

    expect(insertDraft).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: OWNER, baseSketchIds: [] }),
    );
  });
});

// Blocarea e regula IREVERSIBILĂ a feature-ului: odată ce cineva a construit peste o foaie, foaia nu
// mai poate dispărea complet de sub desenul de deasupra.
describe("Stack — blocarea foilor la publicare", () => {
  const BASE_A = "aaaaaaaa-1111-4111-8111-111111111111";
  const BASE_B = "bbbbbbbb-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.mocked(getRoleByUserId).mockResolvedValue({
      roleMain: "PROIECTANT",
      subRole: null,
      verificationStatus: "VERIFIED",
    } as never);
    vi.mocked(publishFromDraft).mockResolvedValue(true as never);
  });

  it("publicarea blochează exact foile din rețetă", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ baseSketchIds: [BASE_A, BASE_B] }) as never);

    const res = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(res).toEqual({ ok: true });
    expect(lockStackBases).toHaveBeenCalledWith([BASE_A, BASE_B], expect.any(Date));
  });

  it("schiță fără fundal → nu blochează nimic", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ baseSketchIds: null }) as never);

    await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(lockStackBases).not.toHaveBeenCalled();
    expect(updateBaseSketchIds).not.toHaveBeenCalled();
  });

  it("CURSĂ — o foaie ștearsă între capturare și publicare e curățată din rețetă, nu lăsată moartă", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ baseSketchIds: [BASE_A, BASE_B] }) as never);
    // BASE_B a fost șters între timp (nu era încă blocat, deci ștergerea era permisă).
    vi.mocked(filterPublishedSketchIds).mockResolvedValue([BASE_A]);

    const res = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(res).toEqual({ ok: true });
    // Rețeta se rescrie fără referința moartă — altfel randarea ar sări tăcut o foaie.
    expect(updateBaseSketchIds).toHaveBeenCalledWith(SID, [BASE_A]);
    // Se blochează doar ce mai există.
    expect(lockStackBases).toHaveBeenCalledWith([BASE_A], expect.any(Date));
  });

  it("rețetă neschimbată → nu se rescrie degeaba", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ baseSketchIds: [BASE_A] }) as never);

    await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(updateBaseSketchIds).not.toHaveBeenCalled();
  });

  it("publicare eșuată (cursă pe status) → NU blochează foile altcuiva", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft({ baseSketchIds: [BASE_A] }) as never);
    vi.mocked(publishFromDraft).mockResolvedValue(false as never);

    const res = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(res).toEqual({ ok: false, error: "INVALID_STATE" });
    expect(lockStackBases).not.toHaveBeenCalled();
  });

  it("rolul autorului se îngheață la publicare (pentru «Autor șters · rol» de mai târziu)", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);

    await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(publishFromDraft).toHaveBeenCalledWith(
      SID,
      SKETCH_AUTHOR,
      expect.objectContaining({
        roleSnapshot: { roleMain: "PROIECTANT", subRole: null, verificationStatus: "VERIFIED" },
      }),
    );
  });

  it("autor fără rol (caz limită) → publicarea trece, snapshot null, fără crash", async () => {
    vi.mocked(getSketchById).mockResolvedValue(draft() as never);
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);

    const res = await publish({ sketchId: SID, authorId: SKETCH_AUTHOR });

    expect(res).toEqual({ ok: true });
    expect(publishFromDraft).toHaveBeenCalledWith(
      SID,
      SKETCH_AUTHOR,
      expect.objectContaining({ roleSnapshot: null }),
    );
  });
});
