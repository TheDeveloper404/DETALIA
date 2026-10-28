// Web app manifest (`/manifest.webmanifest`) — nume, culori de brand și iconițe pentru „Adaugă pe ecranul
// principal". Exclus din matcher-ul proxy.ts, altfel browserul ar primi redirect la /login.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DETALIA",
    short_name: "DETALIA",
    description: "Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#a9573a",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
