// Repo Planșă — singurul loc cu acces Drizzle pentru tabelele `canvases` și `canvas_items`.
// Ownership-ul (owner_id === user din sesiune) îl aplică mereu plansaService prin guard direct în `where`
// (update/delete condiționat = atomic, anti-TOCTOU/anti-IDOR — același pattern ca sketchesRepo).
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { canvasItems, canvases } from "@/db/schema";
import type { CanvasDocument } from "@/server/domain/plansa";

export async function insertCanvas(input: { ownerId: string; name: string }) {
  const [row] = await db
    .insert(canvases)
    .values({ ownerId: input.ownerId, name: input.name })
    .returning();
  return row;
}

// Creează o planșă cu document inițial dat (folosit la duplicare — `insertCanvas` normal pornește goală).
export async function insertCanvasWithState(input: {
  ownerId: string;
  name: string;
  state: CanvasDocument | null;
}) {
  const [row] = await db
    .insert(canvases)
    .values({ ownerId: input.ownerId, name: input.name, state: input.state })
    .returning();
  return row;
}

export async function getCanvasById(id: string) {
  const [row] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
  return row ?? null;
}

// Rename condiționat pe owner (guard atomic anti-IDOR). Întoarce true dacă a modificat un rând.
export async function renameCanvasOwned(
  id: string,
  ownerId: string,
  name: string,
): Promise<boolean> {
  const rows = await db
    .update(canvases)
    .set({ name })
    .where(and(eq(canvases.id, id), eq(canvases.ownerId, ownerId)))
    .returning({ id: canvases.id });
  return rows.length > 0;
}

// Salvează documentul (autosave), condiționat pe owner. Întoarce true dacă a modificat un rând.
export async function updateDocumentOwned(
  id: string,
  ownerId: string,
  document: CanvasDocument,
): Promise<boolean> {
  const rows = await db
    .update(canvases)
    .set({ state: document })
    .where(and(eq(canvases.id, id), eq(canvases.ownerId, ownerId)))
    .returning({ id: canvases.id });
  return rows.length > 0;
}

// Actualizează thumbnail-ul (condiționat pe owner). Întoarce true dacă a modificat un rând.
// URL-ul vechi (pt curățarea blob-ului orfan) îl citește serviciul din getCanvasById înainte de update.
export async function updateThumbnailOwned(
  id: string,
  ownerId: string,
  thumbnailUrl: string,
): Promise<boolean> {
  const rows = await db
    .update(canvases)
    .set({ thumbnailUrl })
    .where(and(eq(canvases.id, id), eq(canvases.ownerId, ownerId)))
    .returning({ id: canvases.id });
  return rows.length > 0;
}

// Șterge o planșă condiționat pe owner (cascadă FK pe canvas_items). Întoarce thumbnailUrl (curățare blob).
export async function deleteCanvasOwned(
  id: string,
  ownerId: string,
): Promise<{ deleted: boolean; thumbnailUrl: string | null }> {
  const rows = await db
    .delete(canvases)
    .where(and(eq(canvases.id, id), eq(canvases.ownerId, ownerId)))
    .returning({ thumbnailUrl: canvases.thumbnailUrl });
  return { deleted: rows.length > 0, thumbnailUrl: rows[0]?.thumbnailUrl ?? null };
}

// Lista planșelor unui user pentru „Planșele mele" (fără `state` — greu; doar metadate de listare).
export function listByOwner(ownerId: string) {
  return db
    .select({
      id: canvases.id,
      name: canvases.name,
      thumbnailUrl: canvases.thumbnailUrl,
      updatedAt: canvases.updatedAt,
    })
    .from(canvases)
    .where(eq(canvases.ownerId, ownerId))
    .orderBy(desc(canvases.updatedAt));
}

export type CanvasListItem = Awaited<ReturnType<typeof listByOwner>>[number];

// ───────────────────────────── canvas_items ─────────────────────────────

// Adaugă un detaliu în planșă. Idempotent pe PK compus (un detaliu o singură dată/planșă — decizie v1).
export async function insertItem(canvasId: string, detailId: string) {
  await db.insert(canvasItems).values({ canvasId, detailId }).onConflictDoNothing();
}

// Copiază indexul de detalii al unei planșe pe alta (folosit la duplicare). Idempotent (onConflictDoNothing).
export async function insertItems(canvasId: string, detailIds: string[]) {
  if (detailIds.length === 0) return;
  await db
    .insert(canvasItems)
    .values(detailIds.map((detailId) => ({ canvasId, detailId })))
    .onConflictDoNothing();
}

export async function deleteItem(canvasId: string, detailId: string) {
  await db
    .delete(canvasItems)
    .where(and(eq(canvasItems.canvasId, canvasId), eq(canvasItems.detailId, detailId)));
}

export async function countItems(canvasId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(canvasItems)
    .where(eq(canvasItems.canvasId, canvasId));
  return row?.n ?? 0;
}

// Id-urile detaliilor din index (pentru reconcilierea la load: care items există + care mai sunt accesibile).
export async function listItemDetailIds(canvasId: string): Promise<string[]> {
  const rows = await db
    .select({ detailId: canvasItems.detailId })
    .from(canvasItems)
    .where(eq(canvasItems.canvasId, canvasId));
  return rows.map((r) => r.detailId);
}
