import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Pas intermediar între emailul de magic link și verificarea reală (Auth.js) — anti-prefetch.
// PROBLEMA: unele clienți de mail (Apple Mail Privacy Protection, preview-uri Gmail, filtre de
// securitate corporate) fac GET automat pe linkurile dintr-un email ca să le scaneze — asta
// CONSUMĂ tokenul one-time înainte ca userul să apese efectiv, și userul primește „Verification".
// FIX: emailul nu mai trimite direct linkul de callback Auth.js, ci linkul către PAGINA asta —
// care e inofensivă la un simplu GET automat (nu declanșează nimic). Verificarea reală se
// întâmplă DOAR când userul apasă efectiv butonul de mai jos (click real, nu fetch de scanner).
export default async function VerifyClickPage({
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
            <ShieldCheck className="size-6" />
          </span>
          <CardTitle className="text-[27px] leading-tight tracking-tight">
            {target ? "Aproape gata" : "Link invalid"}
          </CardTitle>
          <CardDescription className="text-[15px]">
            {target
              ? "Apasă butonul ca să finalizezi autentificarea — pasul ăsta există ca linkul să nu fie consumat automat de scanerele de securitate ale aplicațiilor de mail."
              : "Linkul ăsta nu e valid sau a fost deja folosit. Cere un magic link nou."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {target ? (
            <Button asChild size="lg" className="w-full">
              <a href={target}>Conectează-te</a>
            </Button>
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
