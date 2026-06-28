// Helper CLIENT pentru upload imagine direct în Vercel Blob (browser → Blob), ocolind limitele de
// body ale server actions (1MB) / funcțiilor Vercel (~4.5MB). Tokenul + validarea (tip/mărime/auth)
// le dă /api/blob/upload pe server. Întoarce URL-ul public al blob-ului.
import { upload } from "@vercel/blob/client";

export async function uploadImageToBlob(folder: string, file: File): Promise<string> {
  const ext = file.type.split("/")[1] ?? "bin";
  const blob = await upload(`${folder}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: file.type,
  });
  return blob.url;
}
