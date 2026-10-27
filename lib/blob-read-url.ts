// Client-safe: URL-ul stocat se pastreaza pentru editare; numai randarea foloseste ruta autorizata.
export type BlobFileKind = "detail" | "resource" | "sketch" | "canvas" | "canvas-share" | "offer";

export function blobReadUrl(url: string, kind: BlobFileKind, id: string): string {
  return /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\//i.test(url)
    ? `/api/files/${kind}/${id}`
    : url;
}
