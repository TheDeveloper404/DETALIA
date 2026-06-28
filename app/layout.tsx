import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
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
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "DETALIA",
  description:
    "Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SEC-08: nonce-ul CSP pus de proxy pe x-nonce. Îl citim aici (face layout-ul dinamic → nonce mereu proaspăt,
  // potrivit cu headerul CSP) și îl aplicăm pe scriptul inline de pre-paint de mai jos.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="ro"
      // Scriptul pre-paint de mai jos pune `data-intro` pe <html> înainte de hidratare (vezi IntroSplash) →
      // diferă de SSR. suppressHydrationWarning silențiază exact acest mismatch intenționat (ca next-themes).
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Pre-paint: overlay-ul de intro se randează din SSR (e cover-ul, cu logo, din prima pictare).
            Pentru cine l-a văzut deja / reduced-motion, marcăm <html data-intro="seen"> ÎNAINTE de prima
            pictare → CSS-ul îl ascunde instant (fără flash). Script sincron, în capul body-ului. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=sessionStorage.getItem('detalia_intro_seen');var r=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(s||r)document.documentElement.setAttribute('data-intro','seen');}catch(e){}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
