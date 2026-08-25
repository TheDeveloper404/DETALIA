import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/materialOffersRepo", () => ({
  deleteMaterialOffer: vi.fn(),
  getMaterialOfferId: vi.fn(),
  getMaterialOfferWithFiles: vi.fn(),
  listMaterialOffersBySupplier: vi.fn(),
  listMaterialOffersForDetail: vi.fn(),
  replaceMaterialOfferFiles: vi.fn(),
  upsertMaterialOffer: vi.fn(),
}));
vi.mock("@/server/repos/supplierOffersRepo", () => ({ deleteSupplierOffer: vi.fn() }));
vi.mock("@/server/repos/usersRepo", () => ({ getNotificationActor: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/services/notificationService", () => ({
  notifyMaterialOfferSent: vi.fn(),
  notifyMaterialOfferEdited: vi.fn(),
}));

import { deleteBlobs } from "@/lib/storage";
import { getDetailById } from "@/server/repos/detailsRepo";
import {
  deleteMaterialOffer,
  getMaterialOfferId,
  replaceMaterialOfferFiles,
  upsertMaterialOffer,
} from "@/server/repos/materialOffersRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { deleteSupplierOffer } from "@/server/repos/supplierOffersRepo";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifyMaterialOfferEdited, notifyMaterialOfferSent } from "@/server/services/notificationService";

import { sendOrUpdateMaterialOffer, withdrawSupplierParticipation } from "./materialOfferService";

const DETAIL_ID = "22222222-2222-4222-8222-222222222222";
const validFile = {
  url: "https://abc.public.blob.vercel-storage.com/u/x/materials/f.pdf",
  fileName: "lista.pdf",
  fileSize: 100,
};
const input = { userId: "u-1", detailId: DETAIL_ID, message: "Bună, atașat lista", files: [validFile] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue({
    roleMain: "FURNIZOR",
    subRole: null,
    verificationStatus: "UNVERIFIED",
  } as never);
  vi.mocked(getDetailById).mockResolvedValue({
    id: DETAIL_ID,
    ownerId: "owner-x",
    authorId: "owner-x",
    status: "PUBLISHED",
    projectId: null,
    title: "Detaliu T",
  } as never);
  vi.mocked(getMaterialOfferId).mockResolvedValue(null);
  vi.mocked(upsertMaterialOffer).mockResolvedValue("offer-1");
  vi.mocked(replaceMaterialOfferFiles).mockResolvedValue([]);
  vi.mocked(getNotificationActor).mockResolvedValue({ name: "Furnizor Ion" } as never);
});

describe("gating pe rol — doar FURNIZOR poate ofertă (enforce pe server)", () => {
  it("fără rol → NO_ROLE, fără scriere", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
    expect(await sendOrUpdateMaterialOffer(input)).toEqual({ ok: false, error: "NO_ROLE" });
    expect(upsertMaterialOffer).not.toHaveBeenCalled();
  });

  it("rol != FURNIZOR → NOT_FURNIZOR, fără scriere", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue({ roleMain: "EXECUTANT" } as never);
    expect(await sendOrUpdateMaterialOffer(input)).toEqual({ ok: false, error: "NOT_FURNIZOR" });
    expect(upsertMaterialOffer).not.toHaveBeenCalled();
  });
});

describe("SEC-11 — detailId malformat / detaliu inexistent", () => {
  it("detailId ne-UUID → TARGET_NOT_FOUND, fără getRoleByUserId", async () => {
    const r = await sendOrUpdateMaterialOffer({ ...input, detailId: "not-a-uuid" });
    expect(r).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(getRoleByUserId).not.toHaveBeenCalled();
  });

  it("detaliul nu există (sau nu e PUBLISHED) → TARGET_NOT_FOUND", async () => {
    vi.mocked(getDetailById).mockResolvedValue(null as never);
    expect(await sendOrUpdateMaterialOffer(input)).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
  });
});

describe("restrâns la detalii publice — un detaliu de proiect respinge oricine (2026-08-25)", () => {
  it("detail.projectId setat → NOT_PUBLIC, fără scriere", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "owner-x",
      authorId: "owner-x",
      status: "PUBLISHED",
      projectId: "proj-1",
      title: "T",
    } as never);
    expect(await sendOrUpdateMaterialOffer(input)).toEqual({ ok: false, error: "NOT_PUBLIC" });
    expect(upsertMaterialOffer).not.toHaveBeenCalled();
  });
});

describe("nu poți oferta pe propriul detaliu — CANNOT_OFFER_OWN", () => {
  it("ownerId == userul curent → CANNOT_OFFER_OWN, fără scriere", async () => {
    vi.mocked(getDetailById).mockResolvedValue({
      id: DETAIL_ID,
      ownerId: "u-1",
      authorId: "u-1",
      status: "PUBLISHED",
      projectId: null,
      title: "T",
    } as never);
    expect(await sendOrUpdateMaterialOffer(input)).toEqual({ ok: false, error: "CANNOT_OFFER_OWN" });
    expect(upsertMaterialOffer).not.toHaveBeenCalled();
  });
});

describe("validare de business (delegată la domain) — propagă eroarea, fără scriere", () => {
  it("fără fișiere → NO_FILES", async () => {
    expect(await sendOrUpdateMaterialOffer({ ...input, files: [] })).toEqual({ ok: false, error: "NO_FILES" });
    expect(upsertMaterialOffer).not.toHaveBeenCalled();
  });

  it("mesaj gol → MESSAGE_REQUIRED", async () => {
    expect(await sendOrUpdateMaterialOffer({ ...input, message: "  " })).toEqual({
      ok: false,
      error: "MESSAGE_REQUIRED",
    });
  });
});

describe("trimitere nouă vs editare — isNew determinat de existența ofertei ÎNAINTE de upsert", () => {
  it("nicio ofertă anterioară → isNew: true, notifyMaterialOfferSent (nu Edited)", async () => {
    vi.mocked(getMaterialOfferId).mockResolvedValue(null);
    const res = await sendOrUpdateMaterialOffer(input);
    expect(res).toEqual({ ok: true, isNew: true });
    expect(notifyMaterialOfferSent).toHaveBeenCalledTimes(1);
    expect(notifyMaterialOfferEdited).not.toHaveBeenCalled();
    expect(vi.mocked(notifyMaterialOfferSent).mock.calls[0][0]).toMatchObject({
      recipientUserId: "owner-x",
      detailId: DETAIL_ID,
      supplierName: "Furnizor Ion",
    });
  });

  it("ofertă existentă → isNew: false, notifyMaterialOfferEdited (nu Sent)", async () => {
    vi.mocked(getMaterialOfferId).mockResolvedValue("offer-1");
    const res = await sendOrUpdateMaterialOffer(input);
    expect(res).toEqual({ ok: true, isNew: false });
    expect(notifyMaterialOfferEdited).toHaveBeenCalledTimes(1);
    expect(notifyMaterialOfferSent).not.toHaveBeenCalled();
  });

  it("fișiere orfane (înlocuite la editare) → șterse din Blob", async () => {
    vi.mocked(replaceMaterialOfferFiles).mockResolvedValue(["https://old.blob/f1.pdf"]);
    await sendOrUpdateMaterialOffer(input);
    expect(deleteBlobs).toHaveBeenCalledWith(["https://old.blob/f1.pdf"]);
  });
});

describe("notificarea e auxiliară — un eșec acolo NU trebuie să strice rezultatul (oferta e deja salvată)", () => {
  it("notifyMaterialOfferSent aruncă → tot ok: true", async () => {
    vi.mocked(notifyMaterialOfferSent).mockRejectedValue(new Error("email picat"));
    const res = await sendOrUpdateMaterialOffer(input);
    expect(res).toEqual({ ok: true, isNew: true });
  });
});

describe("withdrawSupplierParticipation — 'Retrage' din modal, un singur buton reface starea inițială", () => {
  it("fără ofertă trimisă (doar mâna ridicată) → NU atinge material_offers, doar coboară mâna", async () => {
    vi.mocked(getMaterialOfferId).mockResolvedValue(null);
    const res = await withdrawSupplierParticipation({ userId: "u-1", detailId: DETAIL_ID });
    expect(res).toEqual({ ok: true });
    expect(deleteMaterialOffer).not.toHaveBeenCalled();
    expect(deleteBlobs).not.toHaveBeenCalled();
    expect(deleteSupplierOffer).toHaveBeenCalledWith("u-1", DETAIL_ID);
  });

  it("ofertă existentă → ștearsă + fișierele curățate din Blob + mâna coborâtă (ambele, o singură acțiune)", async () => {
    vi.mocked(getMaterialOfferId).mockResolvedValue("offer-1");
    vi.mocked(deleteMaterialOffer).mockResolvedValue(["https://blob/f1.pdf"]);
    const res = await withdrawSupplierParticipation({ userId: "u-1", detailId: DETAIL_ID });
    expect(res).toEqual({ ok: true });
    expect(deleteMaterialOffer).toHaveBeenCalledWith("offer-1");
    expect(deleteBlobs).toHaveBeenCalledWith(["https://blob/f1.pdf"]);
    expect(deleteSupplierOffer).toHaveBeenCalledWith("u-1", DETAIL_ID);
  });

  it("detailId malformat → no-op sigur, fără nicio scriere", async () => {
    const res = await withdrawSupplierParticipation({ userId: "u-1", detailId: "not-a-uuid" });
    expect(res).toEqual({ ok: true });
    expect(getMaterialOfferId).not.toHaveBeenCalled();
    expect(deleteSupplierOffer).not.toHaveBeenCalled();
  });
});
