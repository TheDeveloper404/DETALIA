// Storage (Vercel Blob) — strat de infra pentru upload-uri. Singurul loc care atinge `@vercel/blob`.
// Tokenul BLOB_READ_WRITE_TOKEN e citit automat de `put()` din env (vezi .env.example).
//
// Securitate: validăm tipul și dimensiunea pe SERVER înainte de upload (frontend-ul nu e sursă de adevăr).
import { put } from "@vercel/blob";

// Limite upload imagine (server-side, sursa de adevăr).
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

export type ImageValidationError = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE";
export type UploadImageResult = { ok: true; url: string } | { ok: false; error: ImageValidationError };

// Validare pură (fără upload) — utilă pentru un guard ieftin înainte de operații de scriere.
export function validateImageFile(file: File): { ok: true } | { ok: false; error: ImageValidationError } {
  if (!file || file.size === 0) return { ok: false, error: "EMPTY" };
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "INVALID_TYPE" };
  }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  return { ok: true };
}

// Urcă o imagine în Blob (acces public) sub un prefix dat și întoarce URL-ul.
async function uploadImage(file: File, prefix: string): Promise<UploadImageResult> {
  const valid = validateImageFile(file);
  if (!valid.ok) return valid;

  const ext = file.type.split("/")[1] ?? "bin";
  const blob = await put(`${prefix}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false, // numele e deja unic (uuid)
    contentType: file.type,
  });
  return { ok: true, url: blob.url };
}

// Imaginea 2D a unui detaliu.
export function uploadDetailImage(file: File): Promise<UploadImageResult> {
  return uploadImage(file, "details");
}

// Poza de profil (avatar) — onboarding.
export function uploadAvatarImage(file: File): Promise<UploadImageResult> {
  return uploadImage(file, "avatars");
}

// Banda de cover a profilului — onboarding (opțional).
export function uploadCoverImage(file: File): Promise<UploadImageResult> {
  return uploadImage(file, "covers");
}

// Thumbnail PNG al unei schițe (randat client-side la SEND). Primește un Blob, validăm doar dimensiunea.
export async function uploadSketchThumbnail(blob: Blob): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  const result = await put(`sketches/${crypto.randomUUID()}.png`, blob, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/png",
  });
  return { ok: true, url: result.url };
}
