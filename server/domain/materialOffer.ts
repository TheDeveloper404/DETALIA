// Ofertă de materiale (Furnizor → autor detaliu): mesaj + fișiere (PDF/Excel/CSV). Validare PURĂ,
// server-side — reguli de business, nu infra (upload-ul propriu-zis + allowlist de tip/mărime sunt în
// lib/upload-limits.ts + app/api/blob/upload, verificate ÎNAINTE ca fișierul să ajungă aici ca URL).

import { BLOB_URL_RE, MAX_MATERIAL_BYTES, MAX_MATERIAL_FILES_PER_OFFER } from "@/lib/upload-limits";

export const MATERIAL_OFFER_MESSAGE_MAX_LENGTH = 2000;

export type MaterialOfferFileInput = {
  url: string;
  fileName: string;
  fileSize: number;
};

export type MaterialOfferValidationError =
  | "MESSAGE_REQUIRED"
  | "MESSAGE_TOO_LONG"
  | "NO_FILES"
  | "TOO_MANY_FILES"
  | "INVALID_FILE";

export type MaterialOfferValidationResult =
  | { ok: true; message: string; files: MaterialOfferFileInput[] }
  | { ok: false; error: MaterialOfferValidationError };

// Mesajul e obligatoriu (decizie de produs, 2026-08-25): fără el, oferta e doar o listă de fișiere fără
// context — „ce e asta?" pentru autor. Cel puțin 1 fișier — un mesaj fără nimic atașat nu e o ofertă
// de materiale, e doar un comentariu (fluxul ăla există deja separat).
export function validateMaterialOfferInput(input: {
  message?: string | null;
  files: MaterialOfferFileInput[];
}): MaterialOfferValidationResult {
  const message = input.message?.trim() ?? "";
  if (!message) return { ok: false, error: "MESSAGE_REQUIRED" };
  if (message.length > MATERIAL_OFFER_MESSAGE_MAX_LENGTH) return { ok: false, error: "MESSAGE_TOO_LONG" };

  if (input.files.length === 0) return { ok: false, error: "NO_FILES" };
  if (input.files.length > MAX_MATERIAL_FILES_PER_OFFER) return { ok: false, error: "TOO_MANY_FILES" };

  for (const f of input.files) {
    // Doar URL-uri din propriul store Blob (nu orice URL arbitrar trimis de client) — fișierul chiar
    // trebuie să fi trecut prin poarta de upload (/api/blob/upload), nu doar "sună a URL valid".
    if (!f.url || !BLOB_URL_RE.test(f.url)) return { ok: false, error: "INVALID_FILE" };
    if (!f.fileName.trim() || f.fileName.length > 255) return { ok: false, error: "INVALID_FILE" };
    if (!Number.isSafeInteger(f.fileSize) || f.fileSize <= 0 || f.fileSize > MAX_MATERIAL_BYTES) {
      return { ok: false, error: "INVALID_FILE" };
    }
  }

  return { ok: true, message, files: input.files };
}
