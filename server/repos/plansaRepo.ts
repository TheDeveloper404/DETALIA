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

export type CanvasItemRow = { detailId: string; sketchId: string | null };

// Adaugă un detaliu SAU o schiță în planșă (sketchId null = detaliu-mamă). Idempotent — indecșii parțiali
// unici din schema (canvas_items_detail_only_uidx / canvas_items_sketch_uidx) resping duplicatul exact;
// `onConflictDoNothing()` FĂRĂ target prinde conflictul indiferent care index parțial se aplică.
export async function insertItem(canvasId: string, detailId: string, sketchId: string | null = null) {
  await db.insert(canvasItems).values({ canvasId, detailId, sketchId }).onConflictDoNothing();
}

// Copiază indexul (detalii + schițe) al unei planșe pe alta (folosit la duplicare). Idempotent.
export async function insertItems(canvasId: string, items: CanvasItemRow[]) {
  if (items.length === 0) return;
  await db
    .insert(canvasItems)
    .values(items.map((it) => ({ canvasId, detailId: it.detailId, sketchId: it.sketchId })))
    .onConflictDoNothing();
}

// Elimină item-ul „detaliu-mamă" (sketchId null) al unui detaliu de pe planșă — NU atinge item-urile de
// schiță ale aceluiași detaliu (rânduri distincte, `sketchId` diferă).
export async function deleteItem(canvasId: string, detailId: string) {
  await db
    .delete(canvasItems)
    .where(
      and(
        eq(canvasItems.canvasId, canvasId),
        eq(canvasItems.detailId, detailId),
        sql`${canvasItems.sketchId} is null`,
      ),
    );
}

// Elimină item-ul unei schițe anume de pe planșă.
export async function deleteSketchItem(canvasId: string, sketchId: string) {
  await db
    .delete(canvasItems)
    .where(and(eq(canvasItems.canvasId, canvasId), eq(canvasItems.sketchId, sketchId)));
}

export async function countItems(canvasId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(canvasItems)
    .where(eq(canvasItems.canvasId, canvasId));
  return row?.n ?? 0;
}

// Index-ul planșei (detalii + schițe) — pentru reconcilierea la load (ce items există + ce mai e accesibil).
export async function listItems(canvasId: string): Promise<CanvasItemRow[]> {
  return db
    .select({ detailId: canvasItems.detailId, sketchId: canvasItems.sketchId })
    .from(canvasItems)
    .where(eq(canvasItems.canvasId, canvasId));
}
