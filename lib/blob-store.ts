// Selectia store-ului ramane server-side; niciun token nu ajunge in browser.
import { get, del } from "@vercel/blob";

import { isOwnBlobUrl } from "@/lib/blob-url";

export function blobStoreOptions(access: "public" | "private") {
  const token =
    access === "private"
      ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
      : process.env.BLOB_READ_WRITE_TOKEN;
  const storeId =
    access === "private" ? process.env.BLOB_PRIVATE_STORE_ID : process.env.BLOB_STORE_ID;
  const resolvedId = (token?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1] ?? storeId)?.replace(
    /^store_/,
    "",
  );
  if (access === "private" && !resolvedId) throw new Error("PRIVATE_BLOB_NOT_CONFIGURED");
  // storeId explicit evita selectarea store-ului public implicit prin OIDC.
  return { ...(token ? { token } : {}), ...(resolvedId ? { storeId: resolvedId } : {}) };
}

export function isPrivateBlobUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\//i.test(url);
}

export async function readOwnBlob(url: string) {
  if (!isOwnBlobUrl(url)) throw new Error("INVALID_BLOB_URL");
  if (isPrivateBlobUrl(url)) {
    const result = await get(url, {
      access: "private",
      ...blobStoreOptions("private"),
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  }
  // Compatibilitate de citire pe durata migrarii. Nu trimitem credientiale la URL-uri publice.
  const result = await fetch(url, { cache: "no-store", redirect: "error" });
  if (!result.ok || !result.body) return null;
  return {
    body: result.body,
    contentType: result.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteOwnBlob(url: string) {
  if (!isOwnBlobUrl(url)) throw new Error("INVALID_BLOB_URL");
  const access = isPrivateBlobUrl(url) ? "private" : "public";
  await del(url, blobStoreOptions(access));
}
