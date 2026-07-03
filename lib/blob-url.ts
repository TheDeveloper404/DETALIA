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
  if (!OWN_STORE_ID) return true; // dev fără Blob configurat — forma generală rămâne poarta
  try {
    return new URL(url).hostname === `${OWN_STORE_ID}.public.blob.vercel-storage.com`;
  } catch {
    return false;
  }
}
