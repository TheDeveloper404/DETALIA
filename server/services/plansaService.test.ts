import { beforeEach, describe, expect, it, vi } from "vitest";

// Fișier NOU (plansaService nu avea teste unitare până acum) — scop ÎNGUST, deliberat: doar poarta de
// acces la proiect adăugată la /code-review (2026-08-09), nu acoperire completă a serviciului.
const { getDetailById } = vi.hoisted(() => ({ getDetailById: vi.fn() }));
const { getCanvasById, listItems } = vi.hoisted(() => ({ getCanvasById: vi.fn(), listItems: vi.fn() }));
const { canAccessProjectDetail } = vi.hoisted(() => ({ canAccessProjectDetail: vi.fn() }));
const { getSketchById } = vi.hoisted(() => ({ getSketchById: vi.fn() }));

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById }));
vi.mock("@/server/repos/plansaRepo", () => ({
  getCanvasById,
  insertItem: vi.fn(),
  listItems,
}));
vi.mock("@/server/repos/sketchesRepo", () => ({ getSketchById }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { addDetailToCanvas, getCanvasForEdit } from "./plansaService";

const CANVAS_ID = "11111111-1111-4111-8111-111111111111";
const DETAIL_ID = "22222222-2222-4222-8222-222222222222";
const OWNER = "canvas-owner-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addDetailToCanvas — proiecte, gol găsit la /code-review", () => {
  it("non-membru nu poate copia imaginea unui detaliu de proiect pe propria planșă", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({ id: CANVAS_ID, ownerId: OWNER } as never);
    vi.mocked(getDetailById).mockResolvedValueOnce({
      id: DETAIL_ID,
      ownerId: "someone-else",
      imageUrl: "https://blob/x.png",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await addDetailToCanvas({ canvasId: CANVAS_ID, ownerId: OWNER, detailId: DETAIL_ID });

    expect(res).toEqual({ ok: false, error: "DETAIL_NOT_FOUND" });
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: OWNER });
  });
});

describe("getCanvasForEdit — membru eliminat nu mai vede detaliul la reîncărcarea planșei", () => {
  it("item direct (fără schiță) pe un detaliu de proiect fără acces → tratat ca dispărut (skip)", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({ id: CANVAS_ID, ownerId: OWNER, name: "P", state: null } as never);
    vi.mocked(listItems).mockResolvedValueOnce([{ detailId: DETAIL_ID, sketchId: null }] as never);
    vi.mocked(getDetailById).mockResolvedValueOnce({
      id: DETAIL_ID,
      title: "Detaliu privat",
      imageUrl: "https://blob/x.png",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({ ok: true, value: { id: CANVAS_ID, name: "P", document: null, items: [] } });
  });

  it("item de schiță pe un detaliu de proiect fără acces → tratat ca dispărut (skip)", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({ id: CANVAS_ID, ownerId: OWNER, name: "P", state: null } as never);
    vi.mocked(listItems).mockResolvedValueOnce([{ detailId: DETAIL_ID, sketchId: "sk-1" }] as never);
    vi.mocked(getSketchById).mockResolvedValueOnce({
      status: "PUBLISHED",
      thumbnailUrl: "https://blob/sk.png",
    } as never);
    vi.mocked(getDetailById).mockResolvedValueOnce({
      id: DETAIL_ID,
      title: "Detaliu privat",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({ ok: true, value: { id: CANVAS_ID, name: "P", document: null, items: [] } });
  });

  it("cu acces la proiect → itemul apare normal", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({ id: CANVAS_ID, ownerId: OWNER, name: "P", state: null } as never);
    vi.mocked(listItems).mockResolvedValueOnce([{ detailId: DETAIL_ID, sketchId: null }] as never);
    vi.mocked(getDetailById).mockResolvedValueOnce({
      id: DETAIL_ID,
      title: "Detaliu proiect",
      imageUrl: "https://blob/x.png",
      projectId: "proj-1",
    } as never);
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({
      ok: true,
      value: {
        id: CANVAS_ID,
        name: "P",
        document: null,
        items: [{ detailId: DETAIL_ID, sketchId: null, imageUrl: "https://blob/x.png", title: "Detaliu proiect" }],
      },
    });
  });
});
