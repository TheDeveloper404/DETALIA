import type { BlobFileKind } from "@/lib/blob-read-url";
import { isOwnBlobUrl, isUsersBlobUrl } from "@/lib/blob-url";
import { isPrivateBlobUrl } from "@/lib/blob-store";
import { deleteBlobs } from "@/lib/storage";
import { isUuid } from "@/server/domain/ids";
import { getBlobFile, getBlobFileReferences } from "@/server/repos/blobFilesRepo";
import { canAccessProjectDetail } from "@/server/services/projectService";

// Namespace-ul upload-ului nu inlocuieste accesul curent la continutul deja persistat.
// Fisierele noi (inca nereferite) sunt accesibile numai celui care le-a urcat.
export async function canUseBlobUrls(urls: string[], userId: string): Promise<boolean> {
  if (urls.some((url) => !isUsersBlobUrl(url, userId))) return false;
  const privateUrls = [...new Set(urls.filter(isPrivateBlobUrl))];
  if (!privateUrls.length) return true;
  const refs = await getBlobFileReferences(privateUrls);
  for (const url of privateUrls) {
    const matches = refs.filter((ref) => ref.url === url);
    if (!matches.length) continue;
    let readable = false;
    for (const ref of matches) {
      if ((await getReadableBlobFile(ref.kind, ref.id, userId)).ok) {
        readable = true;
        break;
      }
    }
    if (!readable) return false;
  }
  return true;
}

// Sursa trimisa de client se sterge doar ca staging: imagine de detaliu a userului, nefolosita in DB.
// Altfel un URL al altui detaliu propriu (cu schite ale altora) ar fi sters ocolind regula de stergere.
export async function deleteStagingBlobs(urls: (string | null | undefined)[], userId: string) {
  const candidates = urls.filter((url): url is string => {
    if (!url || !isUsersBlobUrl(url, userId)) return false;
    return new URL(url).pathname.startsWith(`/u/${userId}/details/`);
  });
  if (!candidates.length) return;
  const referenced = new Set((await getBlobFileReferences(candidates)).map((ref) => ref.url));
  await deleteBlobs(candidates.filter((url) => !referenced.has(url)));
}

// Decizia se ia pe entitatea din DB, nu pe URL-ul sau proprietarul upload-ului din browser.
export async function getReadableBlobFile(kind: string, id: string, userId: string | null) {
  if (
    !["detail", "resource", "sketch", "canvas", "canvas-share", "offer"].includes(kind) ||
    !isUuid(id)
  ) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }
  const row = await getBlobFile(kind as BlobFileKind, id);
  if (!row?.url || !isOwnBlobUrl(row.url))
    return { ok: false as const, error: "NOT_FOUND" as const };
  if ("hidden" in row && row.hidden) return { ok: false as const, error: "FORBIDDEN" as const };
  if ("sketchStatus" in row && row.sketchStatus !== "PUBLISHED") {
    if (row.sketchStatus !== "DRAFT" || row.sketchAuthorId !== userId) {
      return {
        ok: false as const,
        error: userId ? ("FORBIDDEN" as const) : ("UNAUTHORIZED" as const),
      };
    }
  }
  let allowed = false;
  if (kind === "canvas") {
    allowed = "ownerId" in row && row.ownerId === userId;
  } else if (kind === "offer") {
    // Autorul retras de pe detaliu nu mai primeste ofertele lui (ca in getMaterialOffersForOwner).
    allowed = "supplierId" in row &&
      (row.supplierId === userId || (row.ownerId === userId && !row.ownerWithdrawn));
  } else if ("detailStatus" in row && row.detailStatus === "DRAFT") {
    allowed = row.ownerId === userId && !("projectId" in row && row.projectId);
  } else if ("projectId" in row && row.projectId) {
    allowed = !!userId && (await canAccessProjectDetail({ projectId: row.projectId, userId }));
  } else if ("detailStatus" in row) {
    allowed = row.detailStatus === "PUBLISHED";
  }
  if (!allowed)
    return {
      ok: false as const,
      error: userId ? ("FORBIDDEN" as const) : ("UNAUTHORIZED" as const),
    };
  return {
    ok: true as const,
    url: row.url,
    fileName: "fileName" in row ? row.fileName : undefined,
  };
}
