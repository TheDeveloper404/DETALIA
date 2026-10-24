// Doar paginile publice cu conținut de indexat (toate în PUBLIC_PATHS din proxy.ts — o pagină scoasă de
// acolo trebuie scoasă și de aici, altfel Search Console o raportează „Page with redirect"). Detaliile stau
// în spatele autentificării, iar `/login` și teaserele `/s/[id]` (link-uri de share) n-au ce căuta în index.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

const SITEMAP_PATHS = ["/", "/ghid", "/signup", "/termeni", "/confidentialitate"];

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path) => ({ url: `${siteUrl()}${path === "/" ? "" : path}` }));
}
