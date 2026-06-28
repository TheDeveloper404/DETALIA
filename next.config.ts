import type { NextConfig } from "next";

// SEC-08 — Content-Security-Policy. `unsafe-inline` pe script e necesar pt scriptul de pre-paint (intro) +
// bootstrap-ul Next (nonce ar cere middleware dedicat — hardening ulterior). Suprafața XSS e mică (React
// escapează, fără HTML user, SVG blocat, imagini re-encodate). Permitem Vercel Blob (img/upload) și toolbar-ul
// `vercel.live` (preview comments). Verifică pe preview că nimic nu e blocat în consolă.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://vercel.live https://vercel.com",
  "font-src 'self' data: https://vercel.live",
  "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://vercel.live wss://*.pusher.com https://*.pusher.com",
  "frame-src https://vercel.live",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
