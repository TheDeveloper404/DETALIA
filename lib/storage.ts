// Storage (Vercel Blob) — strat de infra pentru upload-uri. Singurul loc care atinge `@vercel/blob`.
// Tokenul BLOB_READ_WRITE_TOKEN e citit automat de `put()` din env (vezi .env.example).
//
// Securitate: validăm tipul și dimensiunea pe SERVER înainte de upload (frontend-ul nu e sursă de adevăr).
import { del, put } from "@vercel/blob";

// Limitele de upload trăiesc în `lib/upload-limits.ts` (partajate client+server, fără SDK Blob).
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";

export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };

export type ImageValidationError = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE" | "UPLOAD_FAILED";
export type UploadImageResult = { ok: true; url: string } | { ok: false; error: ImageValidationError };

// NOTĂ: upload-urile de imagini (avatar, cover, imagine detaliu) se fac acum CLIENT direct în Blob
// (`@vercel/blob/client` → /api/blob/upload), ca să ocolească limita de body a server actions (1MB)
// și a funcțiilor Vercel (~4.5MB). Aici a rămas doar upload-ul thumbnail-ului de schiță, care e un
// Blob mic randat client-side și trimis printr-un server action (sub limită).

// Thumbnail PNG al unei schițe (randat client-side la SEND). Primește un Blob, validăm doar dimensiunea.
export async function uploadSketchThumbnail(blob: Blob): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  try {
    const result = await put(`sketches/${crypto.randomUUID()}.png`, blob, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
    });
    return { ok: true, url: result.url };
  } catch (err) {
    console.error("Upload thumbnail Blob eșuat:", err instanceof Error ? err.message : "necunoscut");
    return { ok: false, error: "UPLOAD_FAILED" };
  }
}

// Ștergere best-effort a unor blob-uri (ex: la ștergerea unui detaliu — imaginea lui + thumbnail-urile
// schițelor). NU aruncă: o eroare de storage nu trebuie să rateze ștergerea logică din DB (un blob
// orfan = doar risipă de storage, nu o eroare de utilizator). Acceptăm doar URL-uri Blob (https) —
// asset-urile seed din /public (ex: "/seed/...") sunt ignorate, nu sunt în Blob.
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => !!u && u.startsWith("https://"));
  if (valid.length === 0) return;
  try {
    await del(valid);
  } catch (err) {
    console.error("Ștergere Blob eșuată:", err instanceof Error ? err.message : "necunoscut");
  }
}
