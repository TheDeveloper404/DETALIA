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
};

export default nextConfig;
