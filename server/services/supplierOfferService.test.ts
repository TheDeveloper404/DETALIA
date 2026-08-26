import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/supplierOffersRepo", () => ({
  deleteSupplierOffer: vi.fn(),
  insertSupplierOfferIfAbsent: vi.fn(),
  isSupplierOfferedByUser: vi.fn(),
  listSupplierOffersForDetail: vi.fn(),
}));

import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  deleteSupplierOffer,
  insertSupplierOfferIfAbsent,
} from "@/server/repos/supplierOffersRepo";

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

// FĂRĂ notificare la ridicarea mâinii (2026-08-26, feedback: notificarea reală vine STRICT din
// materialOfferService, la trimiterea conținutului ofertei — vezi materialOfferService.test.ts).
describe("toggle reversibil — DOAR ridicare/retragere mână, fără efect de notificare ȘI fără auto-save", () => {
  it("primul click (nu oferta încă) → doar insert, offering: true", async () => {
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: true });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
  });

  it("al doilea click (deja ofertează, insert respinge conflictul) → retrage (delete), offering: false", async () => {
    vi.mocked(insertSupplierOfferIfAbsent).mockResolvedValue(false);
    const r = await toggleSupplierOffer(input);
    expect(r).toEqual({ ok: true, offering: false });
    expect(insertSupplierOfferIfAbsent).toHaveBeenCalledWith("u-1", DETAIL_ID);
    expect(deleteSupplierOffer).toHaveBeenCalledWith("u-1", DETAIL_ID);
  });
});

// Restrâns la detalii PUBLICE (2026-08-25, decizie de produs): pe proiecte private nu are sens
// comercial. Înlocuiește vechea regulă (2026-08-09) de „non-membru nu poate oferta" — acum NIMENI
// nu poate, indiferent de membership (simplificare + restricție, nu doar redenumire).
describe("Restrâns la detalii publice — un detaliu de proiect respinge oricine", () => {
  it("detaliu cu projectId setat → TARGET_NOT_FOUND, fără scriere (indiferent de membership)", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "owner-x",
      authorId: "owner-x",
      status: "PUBLISHED",
      title: "T",
      projectId: "proj-1",
    } as never);

    const res = await toggleSupplierOffer(input);

    expect(res).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(insertSupplierOfferIfAbsent).not.toHaveBeenCalled();
  });
});
