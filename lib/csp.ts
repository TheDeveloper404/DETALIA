// SEC-08 (hardening) — Content-Security-Policy cu NONCE per request.
//
// `script-src` NU mai are `'unsafe-inline'`: scripturile inline (pre-paint intro din layout + bootstrap-ul
// Next) sunt permise DOAR prin nonce-ul generat în `proxy.ts` la fiecare request. Asta închide vectorul XSS
// prin injecție de <script> inline.
//
// EXCEPȚIE deliberată: `style-src` păstrează `'unsafe-inline'`. Aplicația folosește masiv `style={{}}` din
// React → devin ATRIBUTE `style="..."`, pe care un nonce NU le acoperă (nonce-ul merge doar pe <style>/<script>
// tags, nu pe atribute). Riscul XSS prin atribut style e mult mai mic decât prin script.
//
// FĂRĂ `strict-dynamic`: ar ignora allowlist-ul de host → ar rupe toolbar-ul `vercel.live` pe preview. Păstrăm
// allowlist-ul de host alături de nonce (ambele surse valide). Edge-safe (doar construire de string).

// `previewTools` = includem originile toolbar-ului Vercel (vercel.live/pusher). Ele NU rulează pe
// producție (doar pe preview) → le scoatem din CSP-ul de prod (suprafață mai mică). MVP n-are real-time, deci
// pusher e exclusiv infra toolbar-ului. Storage-ul Blob și Turnstile rămân MEREU (sunt funcțional real).
//
// BUG FIX 2026-07-13: `https://vercel.com` NU e doar toolbar-ul de preview — e API-ul REST real al Vercel
// Blob (`@vercel/blob/client` face PUT-ul de bytes la upload direct pe `vercel.com/api/blob/...`, nu doar pe
// `*.vercel-storage.com`). Gatarea lui în spatele `previewTools` bloca TOATE upload-urile client-side
// (avatar/cover/imagine detaliu/schiță/resurse) pe producție — reprodus confirmat, inclusiv în incognito.
// De-acum e MEREU în connect-src, indiferent de mediu.
export function buildCspHeader(nonce: string, isDev = false, previewTools = true): string {
  const live = previewTools ? " https://vercel.live" : "";
  const liveConnect = previewTools ? " https://vercel.live wss://*.pusher.com https://*.pusher.com" : "";
  const liveFrame = previewTools ? "https://vercel.live " : "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // nonce pt scripturile noastre + Next; host vercel.live doar pe preview; challenges.cloudflare.com = Turnstile.
    // `unsafe-eval` doar în dev (HMR).
    `script-src 'self' 'nonce-${nonce}'${live} https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // vezi nota: atributele style din React nu pot fi noncuite
    `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com${previewTools ? " https://vercel.live https://vercel.com" : ""}`,
    `font-src 'self' data:${live}`,
    `connect-src 'self' https://*.vercel-storage.com https://vercel.com https://challenges.cloudflare.com${liveConnect}`,
    // frame-src: toolbar vercel.live (doar preview) + iframe-ul Turnstile.
    `frame-src ${liveFrame}https://challenges.cloudflare.com`,
    "upgrade-insecure-requests",
  ].join("; ");
}
