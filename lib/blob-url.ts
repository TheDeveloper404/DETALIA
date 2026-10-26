// SEC-A2 — Validare STRICTĂ (server-only) a URL-urilor de Blob: nu doar „un store Vercel Blob oarecare"
// (BLOB_URL_RE, formă generală), ci STORE-UL NOSTRU. Store ID-ul e derivat din BLOB_READ_WRITE_TOKEN
// (format `vercel_blob_rw_<STOREID>_<secret>`) — hostname-ul public e `<storeid>.public.blob.vercel-storage.com`.
// Fără token în env (dev local fără Blob) → fallback pe forma generală, ca fluxurile să meargă neschimbate.
// Fișier SERVER-ONLY (citește un secret din env) — nu-l importa în componente client.

import { BLOB_URL_RE } from "@/lib/upload-limits";

// Extras o singură dată la load. `null` = token absent/malformat → nu putem pinui store-ul.
const OWN_STORE_ID = (() => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const m = token?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  return m ? m[1].toLowerCase() : null;
})();

// URL de imagine acceptat la persistare: store Vercel Blob public ȘI (când știm store-ul) exact al nostru.
export function isOwnBlobUrl(url: string): boolean {
  if (!BLOB_URL_RE.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash)
      return false;
    if (parsed.hostname.includes(".private.blob.")) {
      // SDK-ul si HTTP normalizeaza URL-ul, dar referintele DB se compara textual.
      // Caile generate de noi sunt ASCII fara escape-uri: refuzam aliasurile inainte de orice lookup/read/delete.
      if (parsed.href !== url || parsed.pathname.includes("%") || parsed.pathname.includes("//"))
        return false;
      const privateId =
        process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1] ??
        process.env.BLOB_PRIVATE_STORE_ID;
      return (
        !!privateId &&
        parsed.hostname ===
          `${privateId.replace(/^store_/, "").toLowerCase()}.private.blob.vercel-storage.com`
      );
    }
    const publicId = OWN_STORE_ID ?? process.env.BLOB_STORE_ID;
    return publicId
      ? parsed.hostname ===
          `${publicId.replace(/^store_/, "").toLowerCase()}.public.blob.vercel-storage.com`
      : true;
  } catch {
    return false;
  }
}

// SEC-001 — `isOwnBlobUrl` verifică DOAR că URL-ul e din store-ul nostru, nu CINE l-a urcat. Fără asta,
// orice user autentificat putea trimite URL-ul unei imagini a altui user la `setAvatar`/`updateDetail`/etc.
// și `reprocessBlobImage` îl ștergea ca „original" după re-încărcare (ștergere arbitrară cross-user).
// Căile noi se urcă sub `u/<userId>/...` (impus server-side în `/api/blob/upload`) — aici verificăm că
// URL-ul dat aparține efectiv userului curent înainte să fie reprocesat/persistat/șters.
export function isUsersBlobUrl(url: string, userId: string): boolean {
  if (!isOwnBlobUrl(url)) return false;
  try {
    return new URL(url).pathname.startsWith(`/u/${userId}/`);
  } catch {
    return false;
  }
}
