import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";

// Cadru comun pentru login/signup — aceeași lățime (1320px) și limbaj vizual ca landing-ul:
// header de brand + corp pe două coloane (panou „cum funcționează" în stânga, cardul cu formular
// în dreapta, peste un fundal blueprint) + footer. Panoul e ascuns pe mobil (rămâne doar cardul,
// centrat). Importat din designul Claude Design „Detalia Auth" (2026-06-23).

// Pașii sunt identici pe ambele moduri — complementează hero-ul (nu îl repetă).
const STEPS = [
  {
    n: "01",
    title: "Publici un detaliu",
    body: "Încarci desenul de execuție și contextul lui.",
  },
  {
    n: "02",
    title: "Primești propuneri desenate",
    body: "Alți profesioniști arată pe desen cum ar face.",
  },
  {
    n: "03",
    title: "Comunitatea validează pe roluri",
    body: "Fiecare aprobă sau dezaprobă, cu rolul la vedere.",
  },
];

// Kicker + titlu diferă pe mod; restul panoului e identic.
const PANEL_COPY = {
  login: {
    kicker: "Bun venit înapoi",
    title: "Detaliile tale și dezbaterile lor te așteaptă.",
  },
  signup: {
    kicker: "Comunitate nouă · fii printre primii",
    title: "Un detaliu cântărit de breaslă, nu de un singur autor.",
  },
} as const;

export function AuthShell({
  mode,
  children,
}: {
  mode: "login" | "signup";
  children: ReactNode;
}) {
  const panel = PANEL_COPY[mode];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 flex-none items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center px-6">
          <BrandLogo />
        </div>
      </header>

      <main className="relative flex flex-1 items-center overflow-hidden">
        {/* Fundal blueprint — grilă fină mascată radial spre dreapta-sus (varianta A din landing). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "linear-gradient(#eae0cf 1px,transparent 1px),linear-gradient(90deg,#eae0cf 1px,transparent 1px)",
            backgroundSize: "34px 34px",
            opacity: 0.6,
            WebkitMaskImage:
              "radial-gradient(120% 90% at 82% 42%,#000 0%,transparent 72%)",
            maskImage: "radial-gradient(120% 90% at 82% 42%,#000 0%,transparent 72%)",
          }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 items-center gap-16 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Panou „cum funcționează" — ascuns pe mobil. */}
          <section className="hidden min-h-[520px] flex-col justify-center overflow-hidden rounded-lg border border-border bg-secondary p-12 lg:flex">
            <div className="mb-6 flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.16em] text-primary">
              <span aria-hidden className="inline-block size-1.5 rotate-45 bg-primary" />
              {panel.kicker}
            </div>
            <h2 className="mb-8 max-w-[18ch] text-balance text-3xl font-bold leading-[1.16] tracking-tight text-foreground">
              {panel.title}
            </h2>

            <ul className="flex max-w-[400px] list-none flex-col p-0">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="flex items-start gap-[18px] border-t border-border py-[18px] last:border-b"
                >
                  <span className="w-[26px] flex-none font-mono text-[13px] tracking-[0.06em] text-primary">
                    {s.n}
                  </span>
                  <div>
                    <div className="mb-0.5 text-[16.5px] font-semibold text-foreground">
                      {s.title}
                    </div>
                    <div className="text-sm leading-relaxed text-muted-foreground">{s.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Coloana cu formular — logo de brand peste card. */}
          <div className="flex w-full justify-center">
            <div className="w-full max-w-[420px]">
              <div className="mb-7 flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG static de brand */}
                <img src="/logo.svg" alt="DETALIA" style={{ height: 26, width: "auto", display: "block" }} />
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex-none border-t border-border">
        <div className="mx-auto flex w-full max-w-[var(--container-max)] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <span className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} DETALIA
          </span>
          <span className="text-[13px] text-muted-foreground">
            Detaliul de execuție, pus la dezbatere pe roluri.
          </span>
        </div>
      </footer>
    </div>
  );
}
