// Helper CLIENT pentru upload direct în Vercel Blob (browser → Blob), ocolind limitele de
// body ale server actions (1MB) / funcțiilor Vercel (~4.5MB). Tokenul + validarea (tip/mărime/auth)
// le dă /api/blob/upload pe server (pe baza `clientPayload` = kind). Întoarce URL-ul public al blob-ului.
import { upload } from "@vercel/blob/client";

// HEIC/HEIF (default pe camera iPhone) nu e suportat de sharp pe server — binarele precompilate NU includ
// libheif (codecul HEVC e sub restricții de brevet), imposibil de compilat manual pe funcțiile serverless
// Vercel. Detectăm ÎNAINTE de upload (nu după eșecul serverului) ca să dăm userului un mesaj clar, nu un eșec
// generic. `file.type` poate fi gol pt HEIC în unele browsere → verificăm și extensia din nume.
export class HeicUnsupportedError extends Error {
  constructor() {
    super("HEIC_UNSUPPORTED");
  }
}

// Mesaj partajat — folosit de toate formularele de upload de imagine (detaliu, avatar, cover) ca userul
// să vadă exact aceeași explicație + soluție, oriunde întâlnește problema.
export const HEIC_ERROR_MESSAGE =
  "Poza e în format HEIC (specific iPhone) și nu poate fi procesată încă. Alege altă poză, sau din iPhone: " +
  "Setări → Cameră → Formate → 'Cel mai compatibil' (pozele noi se vor salva ca JPG).";

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif";
}

export async function uploadImageToBlob(
  folder: string,
  file: File,
  kind: "image" | "avatar" = "image",
): Promise<string> {
  if (isHeicFile(file)) throw new HeicUnsupportedError();
  const ext = file.type.split("/")[1] ?? "bin";
  const blob = await upload(`${folder}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: file.type,
    clientPayload: kind,
  });
  return blob.url;
}

// PDF/CAD (DWG/DXF): extensia se ia din NUMELE fișierului (file.type e nesigur/gol pt CAD în
// multe browsere) — serverul revalidează oricum extensia din pathname pentru "cad" (vezi route).
export async function uploadDocToBlob(
  folder: string,
  file: File,
  kind: "pdf" | "cad",
): Promise<string> {
  const nameExt = file.name.split(".").pop()?.toLowerCase();
  const ext = nameExt || (kind === "pdf" ? "pdf" : "bin");
  const blob = await upload(`${folder}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: file.type || "application/octet-stream",
    clientPayload: kind,
  });
  return blob.url;
}
