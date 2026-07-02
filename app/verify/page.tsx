import Link from "next/link";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AutoVerify } from "./auto-verify";

// Pas intermediar între emailul de magic link și verificarea reală (Auth.js) — anti-prefetch.
// PROBLEMA: unele clienți de mail (Apple Mail Privacy, preview-uri Gmail, filtre corporate) fac GET
// automat pe linkurile din email pentru scanare — asta ar CONSUMA tokenul one-time înainte ca userul
// să ajungă efectiv, și userul primește „Verification".
// FIX FĂRĂ CLICK: emailul trimite linkul către PAGINA asta (inofensivă la GET automat). Verificarea
// reală o declanșează <AutoVerify> DIN JAVASCRIPT la montare — scanerele nu rulează JS, browserul da.
// Fără JS (rar): butonul de fallback de mai jos cere un click real.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  const target = validateCallbackUrl(u);

  return (
    <AuthShell mode="login">
      <Card className="w-full gap-6 [--card-spacing:--spacing(8)] shadow-[0_22px_56px_-34px_rgba(33,29,24,0.35)]">
        <CardHeader>
          <span
            aria-hidden
            className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Loader2 className={target ? "size-6 animate-spin" : "size-6"} />
          </span>
          <CardTitle className="text-[27px] leading-tight tracking-tight">
            {target ? "Te conectăm…" : "Link invalid"}
          </CardTitle>
          <CardDescription className="text-[15px]">
            {target
              ? "Un moment — te ducem în feed."
              : "Linkul ăsta nu e valid sau a fost deja folosit. Cere un magic link nou."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {target ? (
            <>
              <AutoVerify target={target} />
              {/* Fallback fără JS: singura variantă în care userul apasă. */}
              <noscript>
                <a
                  href={target}
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground"
                >
                  Conectează-te
                </a>
              </noscript>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                Înapoi la autentificare
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

// SEC-03: allowlist strict — acceptăm DOAR URL-ul de callback Auth.js pe originea noastră
// (`/api/auth/callback/...`), niciodată un URL arbitrar (anti open-redirect/phishing).
function validateCallbackUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(base).origin;
  } catch {
    return null;
  }
  if (parsed.origin !== expectedOrigin) return null;
  if (!parsed.pathname.startsWith("/api/auth/callback/")) return null;
  return parsed.toString();
}
