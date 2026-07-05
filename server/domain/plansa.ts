// Domain Planșă v2 — reguli pure pentru canvasul privat per user (adună detalii + schițează peste ansamblu).
// Engine PROPRIU (nu Excalidraw/tldraw) — vezi docs/ARHITECTURA.md §7.7. STRICT privat la MVP: ownership-ul
// se enforce în plansaService (nu aici). Aici trăiesc doar validările de input independente de DB.
//
// Document persistat opac în `state` jsonb: { version, items, strokes }. `items` = imagini-detaliu poziționate
// (zonă de lucru fixă, coordonate normalizate 0..1, fără rotație — resize doar din colțuri, aspect blocat).
// `strokes` = EXACT tipul din server/domain/sketch.ts (reutilizat 1:1, nu duplicat).

import { isUuid } from "@/server/domain/ids";
import { type Stroke, validateStrokes } from "@/server/domain/sketch";

export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 80;

// Câte detalii poate aduna o planșă (v1 — performanță, anti-abuz). Enforce în service la add.
export const MAX_ITEMS_PER_CANVAS = 30;

// Plafon pe dimensiunea documentului serializat (bytes din JSON.stringify). Barieră anti-abuz finală
// (payload injectat de client), nu un target.
export const MAX_STATE_BYTES = 5_000_000; // 5 MB

// Dimensiuni item (normalizate 0..1 față de zona de lucru). Sub MIN = imagine inutilizabil de mică;
// peste MAX = permite depășire parțială a cadrului, nu absurd de mare (anti-abuz).
export const MIN_ITEM_SIZE = 0.02;
export const MAX_ITEM_SIZE = 1.5;

// Gardă anti-overflow/valori aberante pe z-order (câmp numeric explicit, nu index în array).
export const MAX_Z = 100_000;

export type NameError = "EMPTY" | "TOO_LONG";
export type Validated<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type CanvasItem = {
  id: string;
  detailId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type CanvasDocument = {
  version: 1;
  items: CanvasItem[];
  strokes: Stroke[];
};

export type DocError =
  | "NOT_OBJECT"
  | "TOO_LARGE"
  | "INVALID_VERSION"
  | "INVALID_ITEMS"
  | "TOO_MANY_ITEMS"
  | "INVALID_ITEM"
  | "INVALID_STROKES";

// Normalizează + validează numele. Întoarce valoarea trimmed (sursa de adevăr pentru persistare).
export function validateCanvasName(input: unknown): Validated<string, NameError> {
  const name = typeof input === "string" ? input.trim() : "";
  if (name.length < MIN_NAME_LENGTH) return { ok: false, error: "EMPTY" };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value: name };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validateItem(raw: unknown): CanvasItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const it = raw as Record<string, unknown>;

  if (typeof it.id !== "string" || it.id.length === 0) return null;
  if (!isUuid(it.detailId)) return null;
  if (!isFiniteNumber(it.x) || !isFiniteNumber(it.y)) return null;
  if (!isFiniteNumber(it.width) || it.width < MIN_ITEM_SIZE || it.width > MAX_ITEM_SIZE) return null;
  if (!isFiniteNumber(it.height) || it.height < MIN_ITEM_SIZE || it.height > MAX_ITEM_SIZE) return null;
  if (!isFiniteNumber(it.z) || !Number.isInteger(it.z) || Math.abs(it.z) > MAX_Z) return null;

  return {
    id: it.id,
    detailId: it.detailId,
    x: it.x,
    y: it.y,
    width: it.width,
    height: it.height,
    z: it.z,
  };
}

// Validează STRUCTURAL documentul planșei primit de la client (server = sursa de adevăr).
// `strokes` gol e valid aici (spre deosebire de Schiță, unde EMPTY e eroare — o planșă poate avea
// doar imagini, fără niciun desen) — tratat separat, nu delegat direct la validateStrokes().
export function validateCanvasDocument(input: unknown): Validated<CanvasDocument, DocError> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "NOT_OBJECT" };
  }
  const doc = input as Record<string, unknown>;

  if (doc.version !== 1) return { ok: false, error: "INVALID_VERSION" };

  if (!Array.isArray(doc.items)) return { ok: false, error: "INVALID_ITEMS" };
  if (doc.items.length > MAX_ITEMS_PER_CANVAS) return { ok: false, error: "TOO_MANY_ITEMS" };
  const items: CanvasItem[] = [];
  for (const raw of doc.items) {
    const item = validateItem(raw);
    if (!item) return { ok: false, error: "INVALID_ITEM" };
    items.push(item);
  }

  let strokes: Stroke[] = [];
  if (!Array.isArray(doc.strokes)) return { ok: false, error: "INVALID_STROKES" };
  if (doc.strokes.length > 0) {
    const result = validateStrokes(doc.strokes);
    if (!result.ok) return { ok: false, error: "INVALID_STROKES" };
    strokes = result.value;
  }

  const value: CanvasDocument = { version: 1, items, strokes };
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return { ok: false, error: "NOT_OBJECT" };
  }
  if (bytes > MAX_STATE_BYTES) return { ok: false, error: "TOO_LARGE" };

  return { ok: true, value };
}
