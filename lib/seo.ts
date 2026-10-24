import type { Metadata } from "next";

// OpenGraph comun tuturor paginilor (din app/layout.tsx). Next unește metadata SUPERFICIAL pe cheie de nivel
// 1 — o pagină care își setează propriul `openGraph` (ex. app/s/[id]) îl înlocuiește complet, deci îl
// împrăștie pe acesta ca să nu piardă site_name/locale/type.
export const SITE_OPEN_GRAPH = {
  type: "website",
  locale: "ro_RO",
  siteName: "DETALIA",
} satisfies Metadata["openGraph"];
