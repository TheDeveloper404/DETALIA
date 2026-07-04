// Service Planșă — canvas privat per user (CRITICAL: date private, IDOR). Enforce pe SERVER:
//  - STRICT privat: fiecare read/mutație verifică owner_id === userul din sesiune. `ownerId` vine
//    ÎNTOTDEAUNA de la apelant (sesiune), niciodată din client. O planșă nedeținută → NOT_FOUND
//    (conținut privat-by-design; nu leak-uim existența prin UUID enumerabil).
//  - `state` (snapshot tldraw) e opac: validăm doar că e obiect + sub plafon de bytes (anti-abuz), nu-l parcurgem.
//  - Detaliile adăugate trebuie să fie vizibile (PUBLISHED) — getDetailById filtrează deja pe status.

import {
  MAX_ITEMS_PER_CANVAS,
  validateCanvasName,
  validateCanvasState,
} from "@/server/domain/canvas";
import { isUuid } from "@/server/domain/ids";
import {
  deleteCanvasOwned,
  deleteItem,
  getCanvasById,
  insertCanvas,
  insertItem,
  listByOwner,
  listItemDetailIds,
  renameCanvasOwned,
  updateStateOwned,
  updateThumbnailOwned,
  type CanvasListItem,
} from "@/server/repos/canvasesRepo";
import { getDetailById } from "@/server/repos/detailsRepo";
import { deleteBlobs } from "@/lib/storage";

export type CanvasError =
  | "NOT_FOUND"
  | "INVALID_NAME"
  | "INVALID_STATE"
  | "LIMIT_REACHED"
  | "DETAIL_NOT_FOUND";

export type CanvasResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; error: CanvasError };

// ───────────────────────────── CRUD planșă ─────────────────────────────

export async function createCanvas(input: {
  ownerId: string;
  name: unknown;
}): Promise<CanvasResult<{ canvasId: string }>> {
  const name = validateCanvasName(input.name);
  if (!name.ok) return { ok: false, error: "INVALID_NAME" };
  const row = await insertCanvas({ ownerId: input.ownerId, name: name.value });
  return { ok: true, value: { canvasId: row.id } };
}

export async function renameCanvas(input: {
  canvasId: string;
  ownerId: string;
  name: unknown;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" }; // SEC-11
  const name = validateCanvasName(input.name);
  if (!name.ok) return { ok: false, error: "INVALID_NAME" };
  const ok = await renameCanvasOwned(input.canvasId, input.ownerId, name.value);
  return ok ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

export async function deleteCanvas(input: {
  canvasId: string;
  ownerId: string;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const { deleted, thumbnailUrl } = await deleteCanvasOwned(input.canvasId, input.ownerId);
  if (!deleted) return { ok: false, error: "NOT_FOUND" };
  await deleteBlobs([thumbnailUrl]); // best-effort (nu aruncă)
  return { ok: true };
}

export async function listMyCanvases(ownerId: string): Promise<CanvasListItem[]> {
  return listByOwner(ownerId);
}

// Autosave snapshot — doar owner-ul. `state` opac + mărginit.
export async function saveCanvasState(input: {
  canvasId: string;
  ownerId: string;
  state: unknown;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const state = validateCanvasState(input.state);
  if (!state.ok) return { ok: false, error: "INVALID_STATE" };
  const ok = await updateStateOwned(input.canvasId, input.ownerId, state.value);
  return ok ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

// Thumbnail (PNG randat client-side la salvare). thumbnailUrl e deja urcat în Blob de către action.
export async function saveCanvasThumbnail(input: {
  canvasId: string;
  ownerId: string;
  thumbnailUrl: string;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const existing = await getCanvasById(input.canvasId);
  if (!existing || existing.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };
  const ok = await updateThumbnailOwned(input.canvasId, input.ownerId, input.thumbnailUrl);
  if (!ok) return { ok: false, error: "NOT_FOUND" };
  // Curăță blob-ul vechi (best-effort) DUPĂ ce noul URL e persistat.
  if (existing.thumbnailUrl && existing.thumbnailUrl !== input.thumbnailUrl) {
    await deleteBlobs([existing.thumbnailUrl]);
  }
  return { ok: true };
}

// ───────────────────────────── items (planșă ↔ detalii) ─────────────────────────────

// Adaugă un detaliu în planșă. Verifică: ownership, uuid, detaliul e vizibil (PUBLISHED), plafon items.
// Întoarce datele necesare editorului pentru a crea shape-ul de imagine (imageUrl + titlu).
export async function addDetailToCanvas(input: {
  canvasId: string;
  ownerId: string;
  detailId: string;
}): Promise<CanvasResult<{ detailId: string; imageUrl: string; title: string }>> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  if (!isUuid(input.detailId)) return { ok: false, error: "DETAIL_NOT_FOUND" };

  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };

  const detail = await getDetailById(input.detailId); // null dacă șters/nepublicat
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  // Plafon — doar dacă detaliul nu e deja pe planșă (insert idempotent pe PK). Numărăm după ce știm că
  // ar fi un item nou; dacă e deja prezent, insertItem nu adaugă nimic (onConflictDoNothing) → nu contează.
  const existingIds = await listItemDetailIds(input.canvasId);
  if (!existingIds.includes(input.detailId) && existingIds.length >= MAX_ITEMS_PER_CANVAS) {
    return { ok: false, error: "LIMIT_REACHED" };
  }

  await insertItem(input.canvasId, input.detailId);
  return {
    ok: true,
    value: { detailId: input.detailId, imageUrl: detail.imageUrl, title: detail.title },
  };
}

export async function removeDetailFromCanvas(input: {
  canvasId: string;
  ownerId: string;
  detailId: string;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId) || !isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };
  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };
  await deleteItem(input.canvasId, input.detailId);
  return { ok: true };
}

export type CanvasEditItem = { detailId: string; imageUrl: string; title: string };

// Încarcă planșa pentru editor — DOAR owner-ul (altfel NOT_FOUND). Întoarce snapshot-ul + lista detaliilor
// încă accesibile (index ∩ PUBLISHED), cu datele de randare. Editorul reconciliază la load:
//  - materializează shape-uri pentru items adăugate din popover-ul feed (nu-s încă în snapshot);
//  - înlocuiește cu placeholder „Detaliu indisponibil" shape-urile al căror detaliu a dispărut (șters/nepublicat).
export async function getCanvasForEdit(input: {
  canvasId: string;
  ownerId: string;
}): Promise<
  CanvasResult<{
    id: string;
    name: string;
    state: unknown;
    items: CanvasEditItem[];
  }>
> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };

  const itemIds = await listItemDetailIds(input.canvasId);
  const items: CanvasEditItem[] = [];
  for (const id of itemIds) {
    const detail = await getDetailById(id); // null dacă șters/nepublicat → rămâne placeholder
    if (detail) items.push({ detailId: id, imageUrl: detail.imageUrl, title: detail.title });
  }

  return {
    ok: true,
    value: { id: canvas.id, name: canvas.name, state: canvas.state, items },
  };
}
