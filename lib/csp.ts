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

export function buildCspHeader(nonce: string, isDev = false): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // nonce pt scripturile noastre + Next; host pt toolbar-ul vercel.live (preview). `unsafe-eval` doar în dev (HMR).
    // nonce + host vercel.live (preview) + challenges.cloudflare.com (widget-ul Turnstile pe auth).
    `script-src 'self' 'nonce-${nonce}' https://vercel.live https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // vezi nota: atributele style din React nu pot fi noncuite
    // Editorul Planșă (Excalidraw) — fonturi self-hostate din public/excalidraw-assets (vezi
    // instrumentation-client.ts / canvas-editor.tsx, window.EXCALIDRAW_ASSET_PATH), NU de pe CDN extern.
    // Zero relaxare de CSP pentru editor (spre deosebire de tldraw, care cerea cdn.tldraw.com — înlocuit 2026-07-05).
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://vercel.live https://vercel.com",
    "font-src 'self' data: https://vercel.live",
    "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://vercel.live wss://*.pusher.com https://*.pusher.com https://challenges.cloudflare.com",
    // frame-src: toolbar vercel.live (preview) + iframe-ul Turnstile.
    "frame-src https://vercel.live https://challenges.cloudflare.com",
    "upgrade-insecure-requests",
  ].join("; ");
}
