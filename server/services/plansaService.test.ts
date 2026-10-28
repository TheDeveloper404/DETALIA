import { beforeEach, describe, expect, it, vi } from "vitest";

// Fișier NOU (plansaService nu avea teste unitare până acum) — scop ÎNGUST, deliberat: doar poarta de
// acces la proiect adăugată la /code-review (2026-08-09), nu acoperire completă a serviciului.
const { getDetailById, getDetailsByIds } = vi.hoisted(() => ({
  getDetailById: vi.fn(),
  getDetailsByIds: vi.fn(),
}));
const { getCanvasById, listItems } = vi.hoisted(() => ({
  getCanvasById: vi.fn(),
  listItems: vi.fn(),
}));
const { canAccessProjectDetail } = vi.hoisted(() => ({ canAccessProjectDetail: vi.fn() }));
const { getSketchById, getSketchesByIds } = vi.hoisted(() => ({
  getSketchById: vi.fn(),
  getSketchesByIds: vi.fn(),
}));

vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById, getDetailsByIds }));
vi.mock("@/server/repos/plansaRepo", () => ({
  getCanvasById,
  insertItem: vi.fn(),
  listItems,
}));
vi.mock("@/server/repos/sketchesRepo", () => ({ getSketchById, getSketchesByIds }));
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

    const res = await addDetailToCanvas({
      canvasId: CANVAS_ID,
      ownerId: OWNER,
      detailId: DETAIL_ID,
    });

    expect(res).toEqual({ ok: false, error: "DETAIL_NOT_FOUND" });
    expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "proj-1", userId: OWNER });
  });
});

describe("getCanvasForEdit — membru eliminat nu mai vede detaliul la reîncărcarea planșei", () => {
  // Istoric UNIFICAT (undo/redo) — items + strokes într-un singur snapshot.
  it("reincarca sursa restaurata prin Undo chiar daca indexul a fost eliminat", async () => {
    const document = {
      version: 1,
      items: [
        {
          id: "restored",
          detailId: DETAIL_ID,
          sketchId: null,
          x: 0,
          y: 0,
          width: 0.3,
          height: 0.2,
          z: 0,
        },
      ],
      strokes: [],
    };
    getCanvasById.mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: document,
    });
    listItems.mockResolvedValueOnce([]);
    getSketchesByIds.mockResolvedValueOnce(new Map());
    getDetailsByIds.mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          {
            id: DETAIL_ID,
            title: "Restaurat",
            imageUrl: "https://blob/restored.png",
            projectId: null,
          },
        ],
      ]),
    );
    const result = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });
    expect(getDetailsByIds).toHaveBeenCalledWith([DETAIL_ID]);
    expect(result).toMatchObject({
      ok: true,
      value: { document, items: [{ detailId: DETAIL_ID, title: "Restaurat" }] },
    });
  });

  // Detaliile adăugate trebuie să fie vizibile (PUBLISHED).
  it("Undo nu reda accesul la o sursa de proiect revocata", async () => {
    const document = {
      version: 1,
      items: [{ id: "restored", detailId: DETAIL_ID, x: 0, y: 0, width: 0.3, height: 0.2, z: 0 }],
      strokes: [],
    };
    getCanvasById.mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: document,
    });
    listItems.mockResolvedValueOnce([]);
    getSketchesByIds.mockResolvedValueOnce(new Map());
    getDetailsByIds.mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          {
            id: DETAIL_ID,
            title: "Privat",
            imageUrl: "https://blob/private.png",
            projectId: "project",
          },
        ],
      ]),
    );
    canAccessProjectDetail.mockResolvedValueOnce(false);
    const result = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });
    expect(getDetailsByIds).toHaveBeenCalledWith([DETAIL_ID]);
    expect(result).toMatchObject({ ok: true, value: { items: [] } });
  });

  // Schita trebuie sa apartina detailId-ului dat.
  it("un document falsificat nu leaga o schita privata de un detaliu public", async () => {
    const sketchId = "44444444-4444-4444-8444-444444444444";
    const document = {
      version: 1,
      items: [
        { id: "forged", detailId: DETAIL_ID, sketchId, x: 0, y: 0, width: 0.3, height: 0.2, z: 0 },
      ],
      strokes: [],
    };
    getCanvasById.mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: document,
    });
    listItems.mockResolvedValueOnce([]);
    getSketchesByIds.mockResolvedValueOnce(
      new Map([
        [
          sketchId,
          {
            detailId: "55555555-5555-4555-8555-555555555555",
            status: "PUBLISHED",
            thumbnailUrl: "https://blob/private.png",
          },
        ],
      ]),
    );
    getDetailsByIds.mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          { id: DETAIL_ID, title: "Public", imageUrl: "https://blob/public.png", projectId: null },
        ],
      ]),
    );
    const result = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });
    expect(result).toMatchObject({ ok: true, value: { items: [] } });
  });

  it("item direct (fără schiță) pe un detaliu de proiect fără acces → tratat ca dispărut (skip)", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: null,
    } as never);
    vi.mocked(listItems).mockResolvedValueOnce([{ detailId: DETAIL_ID, sketchId: null }] as never);
    vi.mocked(getSketchesByIds).mockResolvedValueOnce(new Map() as never);
    vi.mocked(getDetailsByIds).mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          {
            id: DETAIL_ID,
            title: "Detaliu privat",
            imageUrl: "https://blob/x.png",
            projectId: "proj-1",
          },
        ],
      ]) as never,
    );
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({
      ok: true,
      value: { id: CANVAS_ID, name: "P", document: null, items: [] },
    });
  });

  it("item de schiță pe un detaliu de proiect fără acces → tratat ca dispărut (skip)", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: null,
    } as never);
    vi.mocked(listItems).mockResolvedValueOnce([
      { detailId: DETAIL_ID, sketchId: "sk-1" },
    ] as never);
    vi.mocked(getSketchesByIds).mockResolvedValueOnce(
      new Map([
        ["sk-1", { detailId: DETAIL_ID, status: "PUBLISHED", thumbnailUrl: "https://blob/sk.png" }],
      ]) as never,
    );
    vi.mocked(getDetailsByIds).mockResolvedValueOnce(
      new Map([
        [DETAIL_ID, { id: DETAIL_ID, title: "Detaliu privat", projectId: "proj-1" }],
      ]) as never,
    );
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(false);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({
      ok: true,
      value: { id: CANVAS_ID, name: "P", document: null, items: [] },
    });
  });

  it("cu acces la proiect → itemul apare normal", async () => {
    vi.mocked(getCanvasById).mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: null,
    } as never);
    vi.mocked(listItems).mockResolvedValueOnce([{ detailId: DETAIL_ID, sketchId: null }] as never);
    vi.mocked(getSketchesByIds).mockResolvedValueOnce(new Map() as never);
    vi.mocked(getDetailsByIds).mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          {
            id: DETAIL_ID,
            title: "Detaliu proiect",
            imageUrl: "https://blob/x.png",
            projectId: "proj-1",
          },
        ],
      ]) as never,
    );
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(res).toEqual({
      ok: true,
      value: {
        id: CANVAS_ID,
        name: "P",
        document: null,
        items: [
          {
            detailId: DETAIL_ID,
            sketchId: null,
            imageUrl: "https://blob/x.png",
            title: "Detaliu proiect",
          },
        ],
      },
    });
  });

  it("N+1 fix: 2 item-uri pe ACELAȘI proiect → un singur query per repo + o singură verificare de acces (dedup)", async () => {
    const DETAIL_ID_2 = "33333333-3333-4333-8333-333333333333";
    vi.mocked(getCanvasById).mockResolvedValueOnce({
      id: CANVAS_ID,
      ownerId: OWNER,
      name: "P",
      state: null,
    } as never);
    vi.mocked(listItems).mockResolvedValueOnce([
      { detailId: DETAIL_ID, sketchId: null },
      { detailId: DETAIL_ID_2, sketchId: null },
    ] as never);
    vi.mocked(getSketchesByIds).mockResolvedValueOnce(new Map() as never);
    vi.mocked(getDetailsByIds).mockResolvedValueOnce(
      new Map([
        [
          DETAIL_ID,
          { id: DETAIL_ID, title: "D1", imageUrl: "https://blob/1.png", projectId: "proj-1" },
        ],
        [
          DETAIL_ID_2,
          { id: DETAIL_ID_2, title: "D2", imageUrl: "https://blob/2.png", projectId: "proj-1" },
        ],
      ]) as never,
    );
    vi.mocked(canAccessProjectDetail).mockResolvedValueOnce(true);

    const res = await getCanvasForEdit({ canvasId: CANVAS_ID, ownerId: OWNER });

    expect(getDetailsByIds).toHaveBeenCalledTimes(1);
    expect(getDetailsByIds).toHaveBeenCalledWith([DETAIL_ID, DETAIL_ID_2]);
    expect(canAccessProjectDetail).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      ok: true,
      value: {
        id: CANVAS_ID,
        name: "P",
        document: null,
        items: [
          { detailId: DETAIL_ID, sketchId: null, imageUrl: "https://blob/1.png", title: "D1" },
          { detailId: DETAIL_ID_2, sketchId: null, imageUrl: "https://blob/2.png", title: "D2" },
        ],
      },
    });
  });
});
