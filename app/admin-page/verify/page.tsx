import Link from "next/link";
import { Loader2 } from "lucide-react";

import { AutoVerify } from "@/app/verify/auto-verify";

// Pas intermediar anti-prefetch pentru magic link-ul de ADMIN (SEC-A1) — același mecanism ca /verify
// (useri): emailul trimite AICI (GET inofensiv, nu consumă nimic), iar consumul real al tokenului
// (/admin-page/verify/confirm) e declanșat DIN JAVASCRIPT la montare. Scanerele de mail fac GET dar nu
// rulează JS → nu mai pot arde tokenul one-time și nici provoca emiterea unei sesiuni de admin.
// Tokenul e opac și target-ul e construit LOCAL (path fix + token) → fără open-redirect.
export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const target = token ? `/admin-page/verify/confirm?token=${encodeURIComponent(token)}` : null;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Loader2 className={target ? "size-6 animate-spin" : "size-6"} />
        </span>
        <h1 className="text-lg font-bold tracking-tight">
          {target ? "Te conectăm…" : "Link invalid"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {target
            ? "Un moment — intri în panoul de administrare."
            : "Linkul ăsta nu e valid. Cere un link nou de pe pagina de login."}
        </p>
      </div>

      {target ? (
        <>
          <AutoVerify target={target} />
          {/* Fallback fără JS: singura variantă în care adminul apasă. */}
          <noscript>
            <a
              href={target}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground"
            >
              Intră în administrare
            </a>
          </noscript>
        </>
      ) : (
        <Link
          href="/admin-page/login"
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          Înapoi la login
        </Link>
      )}
    </main>
  );
}
