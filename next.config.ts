import type { NextConfig } from "next";

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
};

export default nextConfig;
