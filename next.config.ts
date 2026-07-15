import { withPostHogConfig } from "@posthog/nextjs-config";
import { withSentryConfig } from "@sentry/nextjs";
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
];

const nextConfig: NextConfig = {
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
    return [{ source: "/:path*", headers: securityHeaders }];
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
  // VERCEL_ENV nu ajunge niciodată în bundle-ul de CLIENT (nu e prefixat NEXT_PUBLIC_) — fără mapping-ul
  // ăsta, Sentry de pe browser nu poate ști dacă rulează pe preview sau production (vezi sentry-config
  // pt detaliul complet: fără el, evenimentele client cădeau invizibile sub orice filtru de environment).
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
};

// PostHog — source maps pt erori de producție lizibile. No-op complet dacă lipsește cheia (build local
// fără POSTHOG_PERSONAL_API_KEY nu se strică — vezi `enabled` condiționat).
const configWithPostHog = withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? "",
  envId: process.env.POSTHOG_ENV_ID ?? "",
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: {
    enabled: !!process.env.POSTHOG_PERSONAL_API_KEY,
    deleteAfterUpload: true,
  },
});

// Sentry — no-op complet dacă lipsesc env-urile (build local fără cont Sentry nu se strică).
// `tunnelRoute`: erorile trec prin propriul domeniu (`/sentry-tunnel`), nu direct spre *.sentry.io —
// evită ad-blockere ȘI ne scutește de allowlist nou în CSP (`lib/csp.ts` rămâne neatins).
export default withSentryConfig(configWithPostHog, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  tunnelRoute: "/sentry-tunnel",
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
