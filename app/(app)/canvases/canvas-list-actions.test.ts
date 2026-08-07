import { afterEach, describe, expect, it, vi } from "vitest";

// Fix code-review 2026-08-07: renameCanvasAction/duplicateCanvasAction/deleteCanvasAction întorceau
// `void` — un eșec de service (NOT_FOUND etc.) dispărea silențios, fără feedback în UI. Acoperim aici
// maparea rezultat-serviciu → CanvasActionResult (mesaj + revalidate DOAR la succes), netestată până acum.

const { requireActiveUserId, checkLimit, revalidatePath, renameCanvas, duplicateCanvas, deleteCanvas } =
  vi.hoisted(() => ({
    requireActiveUserId: vi.fn(async () => "user-1"),
    checkLimit: vi.fn(async () => ({ ok: true })),
    revalidatePath: vi.fn(),
    renameCanvas: vi.fn(),
    duplicateCanvas: vi.fn(),
    deleteCanvas: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkLimit,
  limiters: { mutation: "mutation" },
}));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId }));
vi.mock("@/server/services/plansaService", () => ({
  renameCanvas,
  duplicateCanvas,
  deleteCanvas,
  createCanvas: vi.fn(),
  addDetailToCanvas: vi.fn(),
  listMyCanvases: vi.fn(),
}));

import { deleteCanvasAction, duplicateCanvasAction, renameCanvasAction } from "./canvas-list-actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

afterEach(() => {
  vi.clearAllMocks();
  requireActiveUserId.mockResolvedValue("user-1");
  checkLimit.mockResolvedValue({ ok: true });
});

describe("renameCanvasAction", () => {
  it("succes → { ok: true } și revalidatePath apelat", async () => {
    renameCanvas.mockResolvedValueOnce({ ok: true, value: undefined });
    const res = await renameCanvasAction({ ok: true }, formData({ canvasId: "c1", name: "Nou" }));
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/canvases");
  });

  it("NOT_FOUND (id învechit) → eroare mapată, FĂRĂ revalidatePath", async () => {
    renameCanvas.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    const res = await renameCanvasAction({ ok: true }, formData({ canvasId: "stale", name: "Nou" }));
    expect(res).toEqual({ ok: false, error: "Planșa nu mai există." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rate-limited → eroare de rate-limit, service NEapelat", async () => {
    checkLimit.mockResolvedValueOnce({ ok: false });
    const res = await renameCanvasAction({ ok: true }, formData({ canvasId: "c1", name: "Nou" }));
    expect(res.ok).toBe(false);
    expect(renameCanvas).not.toHaveBeenCalled();
  });
});

describe("duplicateCanvasAction", () => {
  it("succes → { ok: true } și revalidatePath apelat", async () => {
    duplicateCanvas.mockResolvedValueOnce({ ok: true, value: { canvasId: "c2" } });
    const res = await duplicateCanvasAction(formData({ canvasId: "c1" }));
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/canvases");
  });

  it("NOT_FOUND → eroare mapată, FĂRĂ revalidatePath", async () => {
    duplicateCanvas.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    const res = await duplicateCanvasAction(formData({ canvasId: "stale" }));
    expect(res).toEqual({ ok: false, error: "Planșa nu mai există." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteCanvasAction", () => {
  it("succes → { ok: true } și revalidatePath apelat", async () => {
    deleteCanvas.mockResolvedValueOnce({ ok: true, value: undefined });
    const res = await deleteCanvasAction({ ok: true }, formData({ canvasId: "c1" }));
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/canvases");
  });

  it("NOT_FOUND → eroare mapată, FĂRĂ revalidatePath", async () => {
    deleteCanvas.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    const res = await deleteCanvasAction({ ok: true }, formData({ canvasId: "stale" }));
    expect(res).toEqual({ ok: false, error: "Planșa nu mai există." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
