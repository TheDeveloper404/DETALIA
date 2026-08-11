// Storage (Vercel Blob) — strat de infra pentru upload-uri. Singurul loc care atinge `@vercel/blob`.
// Tokenul BLOB_READ_WRITE_TOKEN e citit automat de `put()` din env (vezi .env.example).
//
// Securitate: validăm tipul și dimensiunea pe SERVER înainte de upload (frontend-ul nu e sursă de adevăr).
import { del } from "@vercel/blob";

import { isOwnBlobUrl } from "@/lib/blob-url";
import { processAndUploadImage } from "@/lib/image-processing";
// Limitele de upload trăiesc în `lib/upload-limits.ts` (partajate client+server, fără SDK Blob).
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

type ImageValidationError = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE" | "UPLOAD_FAILED";
export type UploadImageResult = { ok: true; url: string } | { ok: false; error: ImageValidationError };

// NOTĂ: upload-urile de imagini (avatar, cover, imagine detaliu) se fac acum CLIENT direct în Blob
// (`@vercel/blob/client` → /api/blob/upload), ca să ocolească limita de body a server actions (1MB)
// și a funcțiilor Vercel (~4.5MB). Aici a rămas doar upload-ul thumbnail-ului de schiță, care e un
// Blob mic randat client-side și trimis printr-un server action (sub limită).

// Validare comună (EMPTY/TOO_LARGE) + re-encodare SEC-02 (sharp: magic bytes, strip metadata, plafon
// dimensiuni) — un Blob generat de NOI (canvas/export), dar câmpul de fișier al unui server action e
// tot controlat de client, deci nu se are încredere în el fără verificare reală. Foldere separate per
// tip de conținut (nu doar cosmetic — la curățare/audit se disting blob-urile după prefixul din URL).
async function uploadImage(blob: Blob, folder: string): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  const processed = await processAndUploadImage(blob, folder);
  if (!processed.ok) return { ok: false, error: "INVALID_TYPE" };
  return { ok: true, url: processed.url };
}

// Thumbnail al unei schițe (randat client-side la SEND).
export async function uploadSketchThumbnail(blob: Blob): Promise<UploadImageResult> {
  return uploadImage(blob, "sketches");
}

// Thumbnail al unei planșe (compus client-side la salvare — imagini + strokes pe canvas offscreen).
export async function uploadCanvasThumbnail(blob: Blob): Promise<UploadImageResult> {
  return uploadImage(blob, "canvases");
}

// Copie înghețată a unei planșe, partajată într-un proiect (Faza B, §6B) — primește bytes-urile deja
// re-descărcate SERVER-SIDE de la `canvases.thumbnailUrl` al planșei sursă (projectService.ts), NU un
// export proaspăt client-side. Blob-ul urcat aici e NOU (nu doar referință la URL-ul original): dacă
// planșa sursă e ștearsă/regenerată după partajare, `deleteCanvas` șterge blob-ul EI — al nostru rămâne
// independent.
export async function uploadProjectCanvasShare(blob: Blob): Promise<UploadImageResult> {
  return uploadImage(blob, "project-shares");
}

// Ștergere best-effort a unor blob-uri (ex: la ștergerea unui detaliu — imaginea lui + thumbnail-urile
// schițelor). NU aruncă: o eroare de storage nu trebuie să rateze ștergerea logică din DB (un blob
// orfan = doar risipă de storage, nu o eroare de utilizator). Filtrăm pe `isOwnBlobUrl` (SEC-A2, nu doar
// „un store Vercel Blob oarecare") — un URL dintr-un store vechi/rotit trimis la `del()` respinge server-side
// ÎNTREG batch-ul cu "Some urls are malformed" (văzut recurent în log-urile de preview), blocând ștergerea
// și a celorlalte URL-uri valide din același apel.
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => !!u && isOwnBlobUrl(u));
  if (valid.length === 0) return;
  try {
    await del(valid);
  } catch (err) {
    // Găsit la /code-review QODO (2026-08-11): logam array-ul complet de URL-uri pe eroare — util la
    // debug, dar inutil de expansiv în Vercel Logs (URL-urile Blob sunt long-lived). Doar count + host.
    const host = (() => {
      try {
        return new URL(valid[0]).host;
      } catch {
        return "necunoscut";
      }
    })();
    console.error(
      "Ștergere Blob eșuată:",
      err instanceof Error ? err.message : "necunoscut",
      `(${valid.length} url-uri, host: ${host})`,
    );
  }
}
