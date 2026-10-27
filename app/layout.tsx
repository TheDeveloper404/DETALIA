import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import NextTopLoader from "nextjs-toploader";

import { SITE_OPEN_GRAPH } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonturi de brand pentru landing (paletă proprie, separată de tokenii UI shadcn).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Baza pentru URL-urile absolute din meta (og:image, canonical) — aceeași sursă ca link-urile din emailuri.
  metadataBase: new URL(siteUrl()),
  title: { default: "DETALIA", template: "%s — DETALIA" },
  description:
    "Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.",
  // Fără title/description aici: ar fi moștenite de toate paginile care nu își setează propriul openGraph;
  // fără ele, crawlerele de preview cad pe <title>/description-ul paginii. Imaginea: app/opengraph-image.tsx.
  openGraph: SITE_OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SEC-08: păstrăm randarea dinamică pentru nonce-ul CSP al scripturilor Next.js.
  // Scriptul vechi de intro a fost eliminat; framework-ul aplică nonce-ul automat la SSR.
  await headers();

  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Bară de progres la navigare (feedback instant pe fiecare click) — maschează round-trip-ul
            de la layout-ul dinamic (nonce CSP) și paginile grele (profil). Culoare brand.
            FĂRĂ `nonce`: browserul golește atributul nonce din DOM → mismatch de hidratare pe <style>-ul
            injectat. CSP-ul nostru are deja `style-src 'unsafe-inline'` → stilul nprogress trece fără nonce. */}
        <NextTopLoader
          color="#95492e"
          height={3}
          shadow="0 0 8px #95492e,0 0 4px #95492e"
          showSpinner={false}
          speed={300}
        />
        {children}
        {/* Vercel Web Analytics — vizitatori + page views. First-party (`/_vercel/insights/*`, same-origin)
            → nu necesită excepții CSP. Se activează doar în deploy pe Vercel (no-op în dev). */}
        <Analytics />
      </body>
    </html>
  );
}
