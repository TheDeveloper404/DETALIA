import { headers } from "next/headers";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import shared from "@/components/public-pages/public-pages.module.css";
import { validateCallbackUrl } from "@/lib/verify-callback-url";

import { AutoVerify } from "./auto-verify";

// Pas intermediar între emailul de magic link și verificarea reală (Auth.js) — anti-prefetch.
// PROBLEMA: unele clienți de mail (Apple Mail Privacy, preview-uri Gmail, filtre corporate) fac GET
// automat pe linkurile din email pentru scanare — asta ar CONSUMA tokenul one-time înainte ca userul
// să ajungă efectiv, și userul primește „Verification".
// FIX FĂRĂ CLICK: emailul trimite linkul către PAGINA asta (inofensivă la GET automat). Verificarea
// reală o declanșează <AutoVerify> DIN JAVASCRIPT la montare — scanerele nu rulează JS, browserul da.
// Fără JS (rar): butonul de fallback de mai jos cere un click real.
export const metadata: Metadata = { title: "Verificare" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const target = validateCallbackUrl(u, host);

  return (
    <AuthShell mode="login" presentation="centered">
      <Loader2
        aria-hidden
        className={target ? "size-14 animate-spin text-primary" : "size-14 text-primary"}
      />
      <h1>{target ? "Te conectăm…" : "Link invalid"}</h1>
      <p>
        {target
          ? "Un moment — te ducem în feed."
          : "Linkul ăsta nu e valid sau a fost deja folosit. Cere un magic link nou."}
      </p>
      {target ? (
        <>
          <AutoVerify target={target} />
          {/* Fallback fără JS: singura variantă în care userul apasă. */}
          <noscript>
            <a href={target} className={shared.primaryLink}>
              Conectează-te
            </a>
          </noscript>
        </>
      ) : (
        <Link href="/login" className={shared.primaryLink}>
          Înapoi la autentificare
        </Link>
      )}
    </AuthShell>
  );
}
