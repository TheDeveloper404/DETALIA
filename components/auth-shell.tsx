import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";

// Cadru comun pentru login/signup — aceeași lățime (1320px) și limbaj vizual ca landing-ul:
// header de brand + corp pe două coloane (panou de pitch în stânga, cardul cu formular în dreapta) + footer.
// Panoul de pitch e ascuns pe mobil (rămâne doar cardul, centrat). Copy-ul cardului vine din `children`.
const POINTS = [
  "Publici un detaliu de execuție.",
  "Primești propuneri desenate peste el.",
  "Validare deschisă, pe roluri — cu nume și rol.",
];

export function AuthShell({
  children,
  crossLinkHref,
  crossLinkLabel,
}: {
  children: ReactNode;
  crossLinkHref: string;
  crossLinkLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-6">
          <BrandLogo />
          <Link
            href={crossLinkHref}
            className="text-sm font-medium text-foreground no-underline hover:text-primary"
          >
            {crossLinkLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Panou de pitch (limbaj landing) — ascuns pe mobil. */}
        <section className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.16em] text-primary">
            <span aria-hidden className="inline-block size-1.5 rotate-45 bg-primary" />
            Pre-lansare · Comunitate profesională
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.06] tracking-tight">
            Detaliul de execuție, pus la dezbatere <span className="text-primary">pe roluri</span>.
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Profesioniștii din construcții publică un detaliu, desenează propuneri unul peste altul și îl
            validează deschis — fiecare cu numele și rolul lui.
          </p>
          <ul className="flex flex-col gap-3">
            {POINTS.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span aria-hidden className="mt-1.5 inline-block size-2 shrink-0 rotate-45 bg-primary" />
                <span className="leading-relaxed text-foreground/80">{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Cardul cu formularul. */}
        <div className="flex w-full justify-center">{children}</div>
      </main>

      <footer style={{ background: "#1b1813", color: "#c4bcae" }}>
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm">
          <span style={{ color: "#8c8475" }}>Detaliul de execuție, pus la dezbatere pe roluri.</span>
          <span className="font-mono text-xs" style={{ color: "#6f685e" }}>
            © {new Date().getFullYear()} DETALIA
          </span>
        </div>
      </footer>
    </div>
  );
}
