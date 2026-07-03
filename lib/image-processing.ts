// SEC-02 — Procesare sigură a imaginilor urcate.
//
// Upload-ul se face CLIENT direct în Blob (necesar pt fișiere mari, peste limita funcțiilor). Asta înseamnă
// că bytes NU trec prin server la upload → validarea reală o facem AICI, pe server, la persistare:
//   1. descărcăm blob-ul (DOAR din store-ul nostru — fără SSRF);
//   2. sharp.metadata() = validare reală de format din header (magic bytes), nu `file.type` controlat de client;
//   3. limităm pixelii la intrare (anti-bombă de decompresie);
//   4. aplicăm orientarea EXIF apoi RE-ENCODĂM (sharp strip-uiește metadata implicit → fără EXIF/GPS/ICC/XMP);
//   5. plafonăm dimensiunile; re-urcăm imaginea curată; ștergem originalul (necurat).
// La orice eșec: ștergem blob-ul orfan și respingem.

import { del, put } from "@vercel/blob";
import sharp from "sharp";

import { isOwnBlobUrl } from "@/lib/blob-url";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

// §11c#4 / SEC-02: ștergere best-effort a unui blob orfan, dar cu LOG la eșec (altfel orfanul rămâne fără
// urmă → risipă de storage invizibilă). URL-ul de blob nu e PII (cale random).
async function delOrphan(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    console.warn("blob: ștergere orfan eșuată:", err instanceof Error ? err.message : String(err));
  }
}

const MAX_INPUT_PIXELS = 50_000_000; // ~50MP la intrare → respinge bombele de decompresie înainte de decodare.
const MAX_DIMENSION = 4096; // latura cea mai lungă a imaginii finale.

// Formatele acceptate la IEȘIRE = aceleași ca la upload. Orice altceva (svg, gif, heic, tiff…) e respins.
const FORMAT_MAP = {
  jpeg: { ct: "image/jpeg", ext: "jpg" },
  png: { ct: "image/png", ext: "png" },
  webp: { ct: "image/webp", ext: "webp" },
  avif: { ct: "image/avif", ext: "avif" },
} as const;

type CleanImage = { data: Buffer; contentType: string; ext: string };

// Nucleul: validează + re-encodează un buffer. null = imagine invalidă/neacceptată.
async function cleanImageBuffer(input: Buffer): Promise<CleanImage | null> {
  if (input.byteLength === 0 || input.byteLength > MAX_IMAGE_BYTES) return null;
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
    const meta = await pipeline.metadata();
    const fmt = meta.format ? FORMAT_MAP[meta.format as keyof typeof FORMAT_MAP] : undefined;
    if (!fmt) return null; // format necunoscut sau neacceptat (decodat real, nu după `file.type`).

    const resized = pipeline
      .rotate() // aplică EXIF Orientation, apoi metadata se pierde la re-encodare.
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

    // Re-encodare explicită pe formatul detectat (metadata NU se păstrează by default → strip EXIF/ICC/XMP).
    let data: Buffer;
    switch (meta.format as string) {
      case "jpeg":
        data = await resized.jpeg({ quality: 82 }).toBuffer();
        break;
      case "png":
        data = await resized.png({ compressionLevel: 9 }).toBuffer();
        break;
      case "webp":
        data = await resized.webp({ quality: 82 }).toBuffer();
        break;
      case "avif":
        data = await resized.avif({ quality: 60 }).toBuffer();
        break;
      default:
        return null;
    }
    // sharp poate întoarce un Buffer backat de SharedArrayBuffer (memoria libvips) → undici/`put` îl refuză
    // („SharedArrayBuffer is not allowed"). Copiem bytes-urile într-un Buffer normal (ArrayBuffer ne-shared).
    return { data: Buffer.from(data), contentType: fmt.ct, ext: fmt.ext };
  } catch {
    // sharp aruncă la input necorespunzător / peste limita de pixeli → tratăm ca invalid.
    return null;
  }
}

export type ReprocessResult = { ok: true; url: string } | { ok: false };

// Re-procesează o imagine deja urcată în Blob (primită ca URL). Pe succes întoarce noul URL curat și
// șterge originalul; pe eșec șterge orfanul. `folder` = prefixul de cale în Blob (ex. "details", "avatars").
export async function reprocessBlobImage(url: string, folder: string): Promise<ReprocessResult> {
  // Acceptăm DOAR URL-uri din store-ul nostru → fetch-ul nu poate fi îndreptat spre alte gazde (anti-SSRF).
  if (!isOwnBlobUrl(url)) return { ok: false };

  let input: Buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      await delOrphan(url);
      return { ok: false };
    }
    input = Buffer.from(await res.arrayBuffer());
  } catch {
    await delOrphan(url);
    return { ok: false };
  }

  const clean = await cleanImageBuffer(input);
  if (!clean) {
    await delOrphan(url); // imagine invalidă → curăță orfanul.
    return { ok: false };
  }

  try {
    const uploaded = await put(`${folder}/${crypto.randomUUID()}.${clean.ext}`, clean.data, {
      access: "public",
      addRandomSuffix: false,
      contentType: clean.contentType,
    });
    await delOrphan(url); // originalul necurat → orfan, îl ștergem.
    return { ok: true, url: uploaded.url };
  } catch (err) {
    console.error("reprocess: re-upload Blob eșuat:", err instanceof Error ? err.message : "necunoscut");
    await delOrphan(url);
    return { ok: false };
  }
}

// Variantă pentru bytes deja pe server (ex. thumbnail-ul de schiță, trimis ca Blob printr-un server action).
// Validează + re-encodează și urcă curat. null = invalid.
export async function processAndUploadImage(
  blob: Blob,
  folder: string,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const clean = await cleanImageBuffer(Buffer.from(await blob.arrayBuffer()));
  if (!clean) return { ok: false };
  try {
    const uploaded = await put(`${folder}/${crypto.randomUUID()}.${clean.ext}`, clean.data, {
      access: "public",
      addRandomSuffix: false,
      contentType: clean.contentType,
    });
    return { ok: true, url: uploaded.url };
  } catch (err) {
    console.error("processAndUploadImage: upload Blob eșuat:", err instanceof Error ? err.message : "necunoscut");
    return { ok: false };
  }
}
