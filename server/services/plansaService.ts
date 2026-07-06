// Service Planșă v2 — canvas privat per user, engine PROPRIU (CRITICAL: date private, IDOR). Enforce pe SERVER:
//  - STRICT privat: fiecare read/mutație verifică owner_id === userul din sesiune. `ownerId` vine
//    ÎNTOTDEAUNA de la apelant (sesiune), niciodată din client. O planșă nedeținută → NOT_FOUND
//    (conținut privat-by-design; nu leak-uim existența prin UUID enumerabil).
//  - Documentul ({ version, items, strokes }) se validează STRUCTURAL la fiecare save
//    (validateCanvasDocument — items cu geometrie mărginită, strokes prin validateStrokes de la Schiță).
//  - Detaliile adăugate trebuie să fie vizibile (PUBLISHED) — getDetailById filtrează deja pe status.
//  - Autosave NU verifică dacă fiecare detailId din document mai e PUBLISHED (starea altui user nu are voie
//    să pice salvarea) — reconcilierea placeholder se face doar la citire (getCanvasForEdit).

import { deleteBlobs } from "@/lib/storage";
import { isUuid } from "@/server/domain/ids";
import {
  MAX_ITEMS_PER_CANVAS,
  MAX_NAME_LENGTH,
  type CanvasDocument,
  validateCanvasDocument,
  validateCanvasName,
} from "@/server/domain/plansa";
import { getDetailById } from "@/server/repos/detailsRepo";
import {
  type CanvasListItem,
  deleteCanvasOwned,
  deleteItem,
  deleteSketchItem,
  getCanvasById,
  insertCanvas,
  insertCanvasWithState,
  insertItem,
  insertItems,
  listByOwner,
  listItems,
  renameCanvasOwned,
  updateDocumentOwned,
  updateThumbnailOwned,
} from "@/server/repos/plansaRepo";
import { getSketchById } from "@/server/repos/sketchesRepo";

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

// Duplică o planșă deținută (document + index de detalii). Thumbnail-ul NU se copiază (rămâne null,
// regenerat la primul autosave al copiei) — evită ca ștergerea originalului să șteargă blob-ul
// thumbnail-ului sub picioarele copiei (același URL ar fi fost referit din două rânduri).
export async function duplicateCanvas(input: {
  canvasId: string;
  ownerId: string;
}): Promise<CanvasResult<{ canvasId: string }>> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const source = await getCanvasById(input.canvasId);
  if (!source || source.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };

  const items = await listItems(input.canvasId);
  const name = `${source.name} (copie)`.slice(0, MAX_NAME_LENGTH);
  const created = await insertCanvasWithState({
    ownerId: input.ownerId,
    name,
    state: source.state as CanvasDocument | null,
  });
  await insertItems(created.id, items);
  return { ok: true, value: { canvasId: created.id } };
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

// Autosave document — doar owner-ul. Documentul e validat structural (nu opac ca la tldraw).
export async function saveCanvasDocument(input: {
  canvasId: string;
  ownerId: string;
  document: unknown;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const doc = validateCanvasDocument(input.document);
  if (!doc.ok) return { ok: false, error: "INVALID_STATE" };
  const ok = await updateDocumentOwned(input.canvasId, input.ownerId, doc.value);
  return ok ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

// Thumbnail (PNG compus client-side la salvare). thumbnailUrl e deja urcat în Blob de către action.
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

// Adaugă un detaliu SAU o schiță (peste el) în planșă. Verifică: ownership, uuid, ținta e vizibilă
// (detaliu PUBLISHED / schiță PUBLISHED și aparținând detailId-ului dat), plafon items. Când `sketchId`
// e dat, imaginea folosită e thumbnailUrl-ul COMPUS al schiței (randat o singură dată la publicare —
// vezi sketchService), nu imaginea detaliului-mamă. Întoarce datele necesare editorului să materializeze
// item-ul (imageUrl + titlu).
export async function addDetailToCanvas(input: {
  canvasId: string;
  ownerId: string;
  detailId: string;
  sketchId?: string | null;
}): Promise<CanvasResult<{ detailId: string; sketchId: string | null; imageUrl: string; title: string }>> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  if (!isUuid(input.detailId)) return { ok: false, error: "DETAIL_NOT_FOUND" };
  if (input.sketchId != null && !isUuid(input.sketchId)) return { ok: false, error: "DETAIL_NOT_FOUND" };

  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };

  const detail = await getDetailById(input.detailId); // null dacă șters/nepublicat
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  let imageUrl = detail.imageUrl;
  if (input.sketchId) {
    const sketch = await getSketchById(input.sketchId);
    if (
      !sketch ||
      sketch.status !== "PUBLISHED" ||
      sketch.detailId !== input.detailId ||
      !sketch.thumbnailUrl
    ) {
      return { ok: false, error: "DETAIL_NOT_FOUND" };
    }
    imageUrl = sketch.thumbnailUrl;
  }

  // Plafon — doar dacă item-ul (același detaliu SAU aceeași schiță) nu e deja pe planșă (insert idempotent).
  const existing = await listItems(input.canvasId);
  const already = input.sketchId
    ? existing.some((it) => it.sketchId === input.sketchId)
    : existing.some((it) => it.detailId === input.detailId && it.sketchId === null);
  if (!already && existing.length >= MAX_ITEMS_PER_CANVAS) {
    return { ok: false, error: "LIMIT_REACHED" };
  }

  await insertItem(input.canvasId, input.detailId, input.sketchId ?? null);
  return {
    ok: true,
    value: { detailId: input.detailId, sketchId: input.sketchId ?? null, imageUrl, title: detail.title },
  };
}

export async function removeDetailFromCanvas(input: {
  canvasId: string;
  ownerId: string;
  detailId: string;
  sketchId?: string | null;
}): Promise<CanvasResult> {
  if (!isUuid(input.canvasId) || !isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };
  if (input.sketchId != null && !isUuid(input.sketchId)) return { ok: false, error: "NOT_FOUND" };
  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };
  if (input.sketchId) {
    await deleteSketchItem(input.canvasId, input.sketchId);
  } else {
    await deleteItem(input.canvasId, input.detailId);
  }
  return { ok: true };
}

export type CanvasEditItem = { detailId: string; sketchId: string | null; imageUrl: string; title: string };

// Încarcă planșa pentru editor — DOAR owner-ul (altfel NOT_FOUND). Întoarce documentul + lista items-elor
// încă accesibile (index ∩ PUBLISHED), cu datele de randare. Editorul reconciliază la load:
//  - materializează items pentru detalii/schițe adăugate din popover (în index, dar nu în document);
//  - randează placeholder „Detaliu indisponibil" pentru items a căror țintă a dispărut/nu mai e vizibilă
//    (detaliu șters/nepublicat, sau schiță ștearsă/retrasă din teanc).
export async function getCanvasForEdit(input: {
  canvasId: string;
  ownerId: string;
}): Promise<
  CanvasResult<{
    id: string;
    name: string;
    document: unknown; // CanvasDocument sau null (planșă nouă) — clientul îl normalizează la load
    items: CanvasEditItem[];
  }>
> {
  if (!isUuid(input.canvasId)) return { ok: false, error: "NOT_FOUND" };
  const canvas = await getCanvasById(input.canvasId);
  if (!canvas || canvas.ownerId !== input.ownerId) return { ok: false, error: "NOT_FOUND" };

  const rows = await listItems(input.canvasId);
  const items: CanvasEditItem[] = [];
  for (const row of rows) {
    if (row.sketchId) {
      const sketch = await getSketchById(row.sketchId);
      if (!sketch || sketch.status !== "PUBLISHED" || !sketch.thumbnailUrl) continue; // șters/retras → placeholder
      const detail = await getDetailById(row.detailId);
      items.push({
        detailId: row.detailId,
        sketchId: row.sketchId,
        imageUrl: sketch.thumbnailUrl,
        title: detail?.title ?? "Schiță",
      });
    } else {
      const detail = await getDetailById(row.detailId); // null dacă șters/nepublicat → rămâne placeholder
      if (detail) items.push({ detailId: row.detailId, sketchId: null, imageUrl: detail.imageUrl, title: detail.title });
    }
  }

  return {
    ok: true,
    value: { id: canvas.id, name: canvas.name, document: canvas.state, items },
  };
}
