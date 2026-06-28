import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      // Scriptul pre-paint de mai jos pune `data-intro` pe <html> înainte de hidratare (vezi IntroSplash) →
      // diferă de SSR. suppressHydrationWarning silențiază exact acest mismatch intenționat (ca next-themes).
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Pre-paint: dacă intro-ul de brand trebuie arătat (prima vizită din sesiune, fără reduced-motion),
            marcăm <html data-intro="show"> ÎNAINTE de prima pictare. CSS-ul (html[data-intro=show]::before)
            acoperă landing-ul până montează overlay-ul React → fără flash de landing. IntroSplash scoate
            atributul la dismiss. Script sincron, în capul body-ului, rulează înainte de restul conținutului. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=sessionStorage.getItem('detalia_intro_seen');var r=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!s&&!r)document.documentElement.setAttribute('data-intro','show');}catch(e){}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
