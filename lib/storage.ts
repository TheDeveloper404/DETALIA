// Storage (Vercel Blob) — strat de infra pentru upload-uri. Singurul loc care atinge `@vercel/blob`.
// Tokenul BLOB_READ_WRITE_TOKEN e citit automat de `put()` din env (vezi .env.example).
//
// Securitate: validăm tipul și dimensiunea pe SERVER înainte de upload (frontend-ul nu e sursă de adevăr).
import { del } from "@vercel/blob";

import { processAndUploadImage } from "@/lib/image-processing";
// Limitele de upload trăiesc în `lib/upload-limits.ts` (partajate client+server, fără SDK Blob).
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";

export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };

export type ImageValidationError = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE" | "UPLOAD_FAILED";
export type UploadImageResult = { ok: true; url: string } | { ok: false; error: ImageValidationError };

// NOTĂ: upload-urile de imagini (avatar, cover, imagine detaliu) se fac acum CLIENT direct în Blob
// (`@vercel/blob/client` → /api/blob/upload), ca să ocolească limita de body a server actions (1MB)
// și a funcțiilor Vercel (~4.5MB). Aici a rămas doar upload-ul thumbnail-ului de schiță, care e un
// Blob mic randat client-side și trimis printr-un server action (sub limită).

// Thumbnail al unei schițe (randat client-side la SEND). Primește un Blob; deși îl generăm noi din canvas,
// câmpul de fișier al unui server action e controlat de client → SEC-02: validăm real + re-encodăm cu sharp
// (magic bytes + strip metadata + plafon dimensiuni) înainte de a-l urca.
export async function uploadSketchThumbnail(blob: Blob): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  const processed = await processAndUploadImage(blob, "sketches");
  if (!processed.ok) return { ok: false, error: "INVALID_TYPE" };
  return { ok: true, url: processed.url };
}

// Thumbnail al unei planșe (compus client-side la salvare — imagini + strokes pe canvas offscreen).
// Aceleași garanții ca la schițe (SEC-02: re-encodare sharp + plafon), dar folder separat „canvases"
// — la curățare/audit se pot distinge blob-urile planșelor de cele ale schițelor după prefix.
export async function uploadCanvasThumbnail(blob: Blob): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  const processed = await processAndUploadImage(blob, "canvases");
  if (!processed.ok) return { ok: false, error: "INVALID_TYPE" };
  return { ok: true, url: processed.url };
}

// Ștergere best-effort a unor blob-uri (ex: la ștergerea unui detaliu — imaginea lui + thumbnail-urile
// schițelor). NU aruncă: o eroare de storage nu trebuie să rateze ștergerea logică din DB (un blob
// orfan = doar risipă de storage, nu o eroare de utilizator). Acceptăm doar URL-uri Blob (https) —
// căile relative / asset-urile din /public nu sunt în Blob și se ignoră.
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => !!u && u.startsWith("https://"));
  if (valid.length === 0) return;
  try {
    await del(valid);
  } catch (err) {
    console.error("Ștergere Blob eșuată:", err instanceof Error ? err.message : "necunoscut");
  }
}
