// SEC-P06 (audit securitate 2026-08-20): lipsea complet — `/robots.txt` cădea pe pagina 404 a
// aplicației (HTML, nu text/plain), fără nicio directivă pentru crawlere. Rută deja exclusă din
// matcher-ul proxy.ts (`robots.txt` în regex-ul de la linia 229) și cu header CSP dedicat în
// next.config.ts — doar fișierul lipsea. Convenția nativă Next.js (`MetadataRoute.Robots`) generează
// răspunsul corect fără cod suplimentar de rutare.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin-page/", "/api/", "/verify", "/projects/join/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
