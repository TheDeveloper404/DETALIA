import { withPostHogConfig } from "@posthog/nextjs-config";
import type { NextConfig } from "next";

// SEC-08 — Headere de securitate statice (aceleași pe toate rutele). CSP-ul NU mai e aici: are nonce per
// request → e setat în `proxy.ts` (vezi `lib/csp.ts`). Restul headerelor nu depind de request, deci rămân aici.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // HSTS: și Vercel îl pune, dar îl declarăm explicit (2 ani + subdomenii + preload).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Izolare cross-origin (găsit lipsă la ZAP full-scan, 2026-08-22). COOP/CORP = `same-origin`, sigur
  // (aplicația nu servește nimic menit să fie încorporat/citit din alt origin). COEP = `credentialless`,
  // NU `require-corp`: Vercel Blob (imagini publice) și widget-ul Turnstile sunt cross-origin fără
  // header `Cross-Origin-Resource-Policy` propriu — `require-corp` le-ar bloca; `credentialless` le
  // lasă să încarce (fără cookies, care oricum nu sunt necesare pentru resurse publice).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `sharp` (reprocessBlobImage, lib/image-processing.ts) are binar nativ. `serverExternalPackages`
  // NU e suficient pe Vercel: sursa Next.js exclude explicit `sharp`/`@img/sharp-libvips*` din file
  // tracing când rulează pe platforma Vercel (presupune că platforma le livrează separat) — dacă acel
  // layer intern lipsește/e dezactivat pentru proiect, binarul nu ajunge deloc în bundle-ul lambda:
  // `ERR_DLOPEN_FAILED: libvips-cpp.so... cannot open shared object file` (500 real de producție,
  // 2026-08-20, verificat în PostHog). `outputFileTracingIncludes` forțează includerea explicită,
  // indiferent de ce presupune platforma.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/sharp-libvips*/**/*", "node_modules/@img/sharp-linux*/**/*"],
  },
  experimental: {
    // Trimiterea unei schițe postează prin Server Action strokes JSON + thumbnail PNG (1000px lățime,
    // poate depăși 1MB). Default-ul de 1MB pică cu 413 → ridicăm plafonul. Acțiunea e auth-gated + rate-limited.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Imaginile detaliilor / thumbnail-urile schițelor sunt servite din Vercel Blob (acces public).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // robots.txt/sitemap.xml sunt excluse din matcher-ul proxy.ts (nu au nevoie de nonce, sunt text simplu,
      // nu HTML) → CSP-ul dinamic din lib/csp.ts nu ajunge la ele. Politică statică minimă, doar ca headerul
      // să existe (ZAP: "CSP Header Not Set", risc real aproape nul, dar ieftin de închis).
      {
        source: "/(robots.txt|sitemap.xml)",
        // `frame-ancestors`/`form-action` NU fac fallback la `default-src` (particularitate CSP) —
        // explicite aici ca să nu apară „Failure to Define Directive with No Fallback" la scanere
        // (ZAP 2026-08-22). Risc real era deja zero: fără content HTML de framing/formulare pe aceste
        // rute, plus `X-Frame-Options: DENY` (mai sus) acoperea deja framing-ul.
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; form-action 'none'" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  // VERCEL_ENV nu ajunge niciodată în bundle-ul de CLIENT (nu e prefixat NEXT_PUBLIC_) — folosit de
  // Turnstile (components/auth-form.tsx, app/admin-page/login/login-form.tsx) ca să distingă preview de
  // production (chei de test vs. chei reale). NU mai are legătură cu Sentry (scos 2026-07-16) — comentariul
  // vechi atribuia greșit acest mapping la Sentry client-side.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
};

// PostHog — source maps pt erori de producție lizibile. No-op complet dacă lipsește cheia (build local
// fără POSTHOG_PERSONAL_API_KEY nu se strică — vezi `enabled` condiționat).
// Host-ul de API/release e cel de APLICAȚIE (eu.posthog.com), NU cel de ingest (eu.i.posthog.com,
// folosit de SDK în instrumentation-client.ts/posthog-server.ts) — cheia personală nu e recunoscută
// pe host-ul de ingest (authentication_failed dacă le confunzi).
export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? "",
  envId: process.env.POSTHOG_ENV_ID ?? "",
  host: "https://eu.posthog.com",
  sourcemaps: {
    enabled: !!process.env.POSTHOG_PERSONAL_API_KEY,
    deleteAfterUpload: true,
  },
});
