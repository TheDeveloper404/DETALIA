import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn(), insertSavedDetail: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/supplierOffersRepo", () => ({
  deleteSupplierOffer: vi.fn(),
  insertSupplierOfferIfAbsent: vi.fn(),
  isSupplierOfferedByUser: vi.fn(),
  listSupplierOffersForDetail: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({ notifySupplierOffered: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail: vi.fn() }));

import { getDetailById, insertSavedDetail } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  deleteSupplierOffer,
  insertSupplierOfferIfAbsent,
} from "@/server/repos/supplierOffersRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifySupplierOffered } from "@/server/services/notificationService";
import { canAccessProjectDetail } from "@/server/services/projectService";

import { toggleSupplierOffer } from "./supplierOfferService";

const DETAIL_ID = "22222222-2222-4222-8222-222222222222";
const input = { userId: "u-1", detailId: DETAIL_ID };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue({
    roleMain: "FURNIZOR",
    subRole: null,
    verificationStatus: "UNVERIFIED",
  } as never);
  vi.mocked(getDetailById).mockResolvedValue({
    id: DETAIL_ID,
    // `ownerId` = proprietarul real (vezi nota din sketchService.test.ts).
    ownerId: "owner-x",
    authorId: "owner-x",
    title: "Detaliu T",
  } as never);
  vi.mocked(insertSupplierOfferIfAbsent).mockResolvedValue(true);
  vi.mocked(getNotificationActor).mockResolvedValue({
    name: "Furnizor Ion",
    roleMain: "FURNIZOR",
    subRole: null,
    verification: "UNVERIFIED",
  } as never);
});

describe("gating pe rol — doar FURNIZOR poate ridica mâna (enforce pe server)", () => {
  it("fără rol → NO_ROLE, fără scriere", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "NO_ROLE" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });

  it("rol != FURNIZOR (ex. EXECUTANT) → NOT_FURNIZOR, fără scriere", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({
      roleMain: "EXECUTANT",
      subRole: null,
      verificationStatus: "UNVERIFIED",
    } as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "NOT_FURNIZOR" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });
});

describe("SEC-11 — detailId malformat → TARGET_NOT_FOUND, fără atingere DB", () => {
  it("detailId ne-UUID → TARGET_NOT_FOUND, fără getRoleByUserId", async () => {
    const r = await toggleSupplierOffer({ userId: "u-1", detailId: "not-a-uuid" });
    expect(r).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(getRoleByUserId).not.toHaveBeenCalled();
  });

  it("detaliul nu există (sau nu e PUBLISHED) → TARGET_NOT_FOUND", async () => {
    vi.mocked(getDetailById).mockResolvedValue(null as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });
});

describe("nu poți oferta pe propriul detaliu — CANNOT_OFFER_OWN", () => {
  it("autorul detaliului == userul curent → CANNOT_OFFER_OWN, fără scriere", async () => {
    vi.mocked(getDetailById).mockResolvedValue({ id: DETAIL_ID, ownerId: "u-1", authorId: "u-1", title: "T" } as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });

  // Regresie (găsit la /code-review, 2026-08-06): verificarea trebuie să folosească `ownerId`
  // (proprietarul REAL), nu `authorId` (mascat de anonimizare → null pe un detaliu din care autorul
  // s-a retras). Cu `authorId`, guard-ul devenea inert: fostul autor și-ar fi putut oferta propriul
  // detaliu anonimizat.
  it("detaliu ANONIMIZAT (authorId mascat = null) → tot CANNOT_OFFER_OWN, folosind ownerId", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "u-1",
      authorId: null,
      isAnonymized: true,
      title: "T",
    } as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });
});

describe("toggle reversibil + notificare DOAR la primul click", () => {
  it("primul click (nu oferta încă) → insert + auto-save + notifică autorul, offering: true", async () => {
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: true });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(insertSavedDetail).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(notifySupplierOffered).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySupplierOffered).mock.calls[0][0]).toMatchObject({
      recipientUserId: "owner-x",
      detailId: DETAIL_ID,
      supplierName: "Furnizor Ion",
    });
  });

  it("al doilea click (deja ofertează, insert respinge conflictul) → retrage (delete), FĂRĂ notificare nouă, FĂRĂ auto-save, offering: false", async () => {
    vi.mocked(insertSupplierOfferIfAbsent).mockResolvedValue(false);
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: false });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(deleteSupplierOffer).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(notifySupplierOffered).not.toHaveBeenCalled();
    expect(insertSavedDetail).not.toHaveBeenCalled();
  });

  // Regresie (bug găsit la code-review 2026-07-16): decizia de notificare trebuie să vină STRICT din
  // rezultatul atomic al inserării, nu dintr-o citire separată dinainte — altfel 2 cereri concurente
  // (dublu-click/tab dublu) puteau ambele citi „nu oferta încă" înainte ca vreuna să scrie, trimițând
  // 2 notificări pentru un singur eveniment real.
  it("insertul atomic decide notificarea — o citire separată de stare NU intervine în această decizie", async () => {
    vi.mocked(insertSupplierOfferIfAbsent).mockResolvedValue(true);
    await toggleSupplierOffer(input);
    expect(notifySupplierOffered).toHaveBeenCalledTimes(1);
    expect(deleteSupplierOffer).not.toHaveBeenCalled();
  });
});

describe("efectele secundare (auto-save, notificare) sunt izolate — un eșec acolo NU trebuie să strice rezultatul întors userului", () => {
  it("insertSavedDetail aruncă → toggleSupplierOffer tot întoarce succes (fără să propage eroarea)", async () => {
    vi.mocked(insertSavedDetail).mockRejectedValue(new Error("DB tranzitoriu"));
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: true });
    expect(notifySupplierOffered).toHaveBeenCalledTimes(1);
  });

  it("notifySupplierOffered aruncă → toggleSupplierOffer tot întoarce succes (oferta rămâne validă)", async () => {
    vi.mocked(notifySupplierOffered).mockRejectedValue(new Error("email/notificare picată"));
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: true });
    expect(insertSavedDetail).toHaveBeenCalledWith("u-1", DETAIL_ID);
  });
});

// Proiecte (2026-08-09, gol găsit la /code-review): un FURNIZOR din afara proiectului putea oferta
// pe un detaliu privat, ocolind poarta de acces.
describe("Proiecte — non-membru nu poate oferta pe un detaliu de proiect", () => {
  it("fără acces la proiect → TARGET_NOT_FOUND, fără scriere", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "owner-x",
      authorId: "owner-x",
      title: "T",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await toggleSupplierOffer(input);

    expect(res).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: "u-1" });
  });
});

// Gol găsit la /code-review, 2026-08-09: destinatarul notificării (detail.ownerId) e o persoană
// DIFERITĂ de furnizorul care ofertează — accesul lui la proiect trebuie verificat separat.
describe("Proiecte — notificarea de ofertă nu scurge titlul unui detaliu privat către un owner eliminat", () => {
  it("owner-ul detaliului eliminat din proiect → oferta se înregistrează, dar FĂRĂ notifySupplierOffered", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "owner-x",
      authorId: "owner-x",
      title: "T",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockImplementation(async ({ userId }: { userId: string }) => userId === "u-1");

    const res = await toggleSupplierOffer(input);

    expect(res).toEqual({ ok: true, offering: true });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalled();
    expect(notifySupplierOffered).not.toHaveBeenCalled();
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: "owner-x" });
  });
});
