// Domain Planșă — reguli pure pentru canvasul privat per user (adună detalii + schițează peste ansamblu).
// STRICT privat la MVP: ownership-ul se enforce în canvasService (nu aici). Aici trăiesc doar validările
// de input independente de DB: numele planșei și plafonul de dimensiune al snapshot-ului tldraw (anti-abuz,
// analog cu MAX_STROKES la schițe — `state` e opac, îl mărginim, nu-l parcurgem).

// Numele planșei (dat de user). Trimmed, nevid, mărginit.
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 80;

// Câte detalii poate aduna o planșă (v1 — performanță; §6.4 din spec). Enforce în service la add.
export const MAX_ITEMS_PER_CANVAS = 30;

// Plafon pe dimensiunea snapshot-ului serializat (bytes din JSON.stringify). Un canvas cu ~30 imagini +
// schițe libere e mult sub asta; limita e o barieră anti-abuz (payload injectat de client), nu un target.
export const MAX_STATE_BYTES = 5_000_000; // 5 MB

export type NameError = "EMPTY" | "TOO_LONG";
export type StateError = "NOT_OBJECT" | "TOO_LARGE";
export type Validated<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Normalizează + validează numele. Întoarce valoarea trimmed (sursa de adevăr pentru persistare).
export function validateCanvasName(input: unknown): Validated<string, NameError> {
  const name = typeof input === "string" ? input.trim() : "";
  if (name.length < MIN_NAME_LENGTH) return { ok: false, error: "EMPTY" };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value: name };
}

// Validează snapshot-ul tldraw primit de la client: trebuie să fie un obiect JSON (nu array/primitiv/null)
// și sub plafonul de dimensiune. Nu inspectăm structura internă (o gestionează tldraw la loadSnapshot) —
// o stocăm opac. Întoarce chiar obiectul primit (deja parsat) pentru persistare.
export function validateCanvasState(input: unknown): Validated<Record<string, unknown>, StateError> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "NOT_OBJECT" };
  }
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(input)).length;
  } catch {
    // referințe circulare / valori neserializabile → respinge
    return { ok: false, error: "NOT_OBJECT" };
  }
  if (bytes > MAX_STATE_BYTES) return { ok: false, error: "TOO_LARGE" };
  return { ok: true, value: input as Record<string, unknown> };
}
