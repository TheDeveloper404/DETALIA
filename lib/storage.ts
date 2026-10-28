// Upload si stergere Blob pentru fisiere procesate pe server.
import { del } from "@vercel/blob";

import { isOwnBlobUrl } from "@/lib/blob-url";
import { blobStoreOptions, isPrivateBlobUrl } from "@/lib/blob-store";
import { processAndUploadImage } from "@/lib/image-processing";
// Limitele de upload trăiesc în `lib/upload-limits.ts` (partajate client+server, fără SDK Blob).
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

type ImageValidationError = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE" | "UPLOAD_FAILED";
export type UploadImageResult = { ok: true; url: string } | { ok: false; error: ImageValidationError };

// Upload-urile client (inclusiv thumbnail-urile) merg direct in Blob. Aici raman imaginile deja
// pe server: copiile partajate in proiect si fixture-urile care genereaza thumbnail-uri in E2E.

// Validam si re-encodam inclusiv imaginile generate de client.
async function uploadImage(blob: Blob, folder: string, userId: string): Promise<UploadImageResult> {
  if (!blob || blob.size === 0) return { ok: false, error: "EMPTY" };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_LARGE" };
  const processed = await processAndUploadImage(blob, folder, userId);
  if (!processed.ok) return { ok: false, error: "INVALID_TYPE" };
  return { ok: true, url: processed.url };
}

// Thumbnail al unei planșe (compus client-side la salvare — imagini + strokes pe canvas offscreen).
export async function uploadCanvasThumbnail(blob: Blob, userId: string): Promise<UploadImageResult> {
  return uploadImage(blob, "canvases", userId);
}

// Copie independenta pentru proiect: stergerea plansei sursa nu o afecteaza.
export async function uploadProjectCanvasShare(blob: Blob, userId: string): Promise<UploadImageResult> {
  return uploadImage(blob, "project-shares", userId);
}

// Stergere best-effort dupa mutatia DB; acceptam numai URL-uri din store-urile proprii.
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => !!u && isOwnBlobUrl(u));
  if (valid.length === 0) return;
  try {
    const publicUrls = valid.filter((url) => !isPrivateBlobUrl(url));
    const privateUrls = valid.filter(isPrivateBlobUrl);
    if (publicUrls.length) await del(publicUrls, blobStoreOptions("public"));
    if (privateUrls.length) await del(privateUrls, blobStoreOptions("private"));
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
