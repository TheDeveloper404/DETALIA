// Helper CLIENT pentru upload direct în Vercel Blob (browser → Blob), ocolind limitele de
// body ale server actions (1MB) / funcțiilor Vercel (~4.5MB). Tokenul + validarea (tip/mărime/auth)
// le dă /api/blob/upload pe server (pe baza `clientPayload` = kind). Întoarce URL-ul public al blob-ului.
import { upload } from "@vercel/blob/client";

export async function uploadImageToBlob(
  folder: string,
  file: File,
  kind: "image" | "avatar" = "image",
): Promise<string> {
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
