"use client";

import Link from "next/link";
import { useEffect } from "react";

// Error boundary la nivel de aplicație (sub AppHeader). Prinde excepțiile din Server/Client Components
// și oferă o ieșire: reîncearcă (re-randează segmentul) sau mergi în feed. Fără detalii tehnice către user.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logăm doar mesajul/digest-ul — fără PII. Detaliile reale sunt în logul de server.
    console.error("Eroare neașteptată:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-xl border border-border bg-secondary text-2xl">
          ⚠️
        </div>
        <h1 className="mb-2 font-heading text-[22px] font-bold">Ceva n-a mers</h1>
        <p className="mb-6 leading-relaxed text-muted-foreground">
          A apărut o eroare neașteptată. Poți încerca din nou — dacă persistă, revino puțin mai târziu.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-lg border border-[#95492e] bg-primary px-[22px] py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-[#974a2e]"
          >
            Încearcă din nou
          </button>
          <Link
            href="/feed"
            className="inline-flex items-center rounded-lg border border-border bg-card px-[22px] py-2.5 font-semibold transition-colors hover:border-primary"
          >
            Mergi la feed
          </Link>
        </div>
      </div>
    </main>
  );
}
