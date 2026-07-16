import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/supplierOffersRepo", () => ({
  deleteSupplierOffer: vi.fn(),
  insertSupplierOfferIfAbsent: vi.fn(),
  isSupplierOfferedByUser: vi.fn(),
  listSupplierOffersForDetail: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({ notifySupplierOffered: vi.fn() }));

import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  deleteSupplierOffer,
  insertSupplierOfferIfAbsent,
} from "@/server/repos/supplierOffersRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifySupplierOffered } from "@/server/services/notificationService";

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
    vi.mocked(getDetailById).mockResolvedValue({ id: DETAIL_ID, authorId: "u-1", title: "T" } as never);
    expect(await toggleSupplierOffer(input)).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });
});

describe("toggle reversibil + notificare DOAR la primul click", () => {
  it("primul click (nu oferta încă) → insert + notifică autorul, offering: true", async () => {
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: true });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(notifySupplierOffered).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifySupplierOffered).mock.calls[0][0]).toMatchObject({
      recipientUserId: "owner-x",
      detailId: DETAIL_ID,
      supplierName: "Furnizor Ion",
    });
  });

  it("al doilea click (deja ofertează, insert respinge conflictul) → retrage (delete), FĂRĂ notificare nouă, offering: false", async () => {
    vi.mocked(insertSupplierOfferIfAbsent).mockResolvedValue(false);
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: false });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(deleteSupplierOffer).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(notifySupplierOffered).not.toHaveBeenCalled();
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
