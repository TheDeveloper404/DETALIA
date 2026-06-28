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
    `script-src 'self' 'nonce-${nonce}' https://vercel.live${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // vezi nota: atributele style din React nu pot fi noncuite
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://vercel.live https://vercel.com",
    "font-src 'self' data: https://vercel.live",
    "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://vercel.live wss://*.pusher.com https://*.pusher.com",
    "frame-src https://vercel.live",
    "upgrade-insecure-requests",
  ].join("; ");
}
