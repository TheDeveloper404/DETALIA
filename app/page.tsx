import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

const STEPS = [
  {
    title: "Publici un detaliu",
    body: "Imaginea 2D a detaliului de execuție, contextul și categoria. Devine punctul de pornire al discuției.",
  },
  {
    title: "Primești propuneri",
    body: "Cine vede altfel desenează direct peste detaliu cum ar trebui făcut și îți trimite propunerea, ca s-o accepți sau nu.",
  },
  {
    title: "Comunitatea validează",
    body: "Fiecare aprobă sau dezaprobă, cu numele și rolul lângă părere. O dezaprobare vine mereu cu o justificare.",
  },
];

const BENEFITS = [
  {
    title: "Detalii verificate de breaslă",
    body: "Nu o părere anonimă, ci poziții asumate de profesioniști cu rolul vizibil lângă nume.",
  },
  {
    title: "Vezi cine și cu ce autoritate",
    body: "Numele și rolul stau lângă fiecare aprobare sau obiecție. Greutatea o judeci tu — fără scoruri.",
  },
  {
    title: "Înveți din dezacord",
    body: "Cele mai bune lecții vin din locul unde proiectantul și executantul nu cad de acord.",
  },
  {
    title: "Îți construiești reputația",
    body: "Rolul tău, eventual verificat, te face o voce care contează în comunitate.",
  },
];

const ROLES = ["Proiectant", "Executant", "Furnizor", "Beneficiar"];

const FAQ = [
  {
    q: "E gratuit?",
    a: "Da. Înregistrarea e liberă și deschisă tuturor celor din construcții.",
  },
  {
    q: "Trebuie să fiu verificat ca să postez?",
    a: "Nu. Îți declari rolul la înscriere și poți publica imediat. Verificarea e opțională și o faci mai târziu, când vrei.",
  },
  {
    q: "Cum mă înscriu?",
    a: "O singură dată, fără parolă: cu un link de acces pe email sau cu Google. Atât.",
  },
];

export default async function Home() {
  const session = await auth();
  const authed = Boolean(session?.user);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header propriu (landing-ul nu folosește AppHeader — userul nu e logat) */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">DETALIA</span>
          <nav className="flex items-center gap-2">
            {authed ? (
              <Button asChild>
                <Link href="/feed">Mergi la feed</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Autentificare</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Creează cont</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center sm:pt-28">
          <Badge variant="secondary">Comunitatea profesională din construcții</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Detaliul de execuție, pus la dezbatere pe roluri.
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Pui un detaliu de execuție în fața breslei. Alții îți arată, desenând peste el, cum ar
            trebui făcut. Profesioniștii îl aprobă sau îl contestă — fiecare cu numele și rolul lui.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
            {authed ? (
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/feed">Mergi la feed</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="h-11 px-6">
                  <Link href="/signup">Creează cont gratuit</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-6">
                  <Link href="/login">Autentificare</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Problemă → Soluție */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Problema
              </h2>
              <p className="text-lg leading-relaxed">
                Detaliile de execuție circulă în PDF-uri răzlețe. Fiecare le face altfel, nimeni nu
                le pune cap la cap și nimeni nu le contestă pe roluri. Aceleași greșeli se repetă
                din proiect în proiect.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Soluția
              </h2>
              <p className="text-lg leading-relaxed">
                DETALIA adună detaliile într-un singur loc, viu. Le pui, le dezbați, le validezi —
                transparent, cu rolul fiecăruia lângă părere. Așa, un detaliu bun iese la suprafață.
              </p>
            </div>
          </div>
        </section>

        {/* Cum funcționează */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Cum funcționează
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
                >
                  <span className="text-sm font-semibold text-muted-foreground">0{i + 1}</span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Beneficii */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Ce câștigi</h2>
            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex flex-col gap-1.5 border-t border-border pt-4">
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pentru cine */}
        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Pentru toți cei din construcții</h2>
            <p className="max-w-xl text-muted-foreground">
              Rolul tău e vizibil permanent lângă nume. Așa, cititorul cântărește corect fiecare
              părere — fără scoruri, doar transparență.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {ROLES.map((r) => (
                <Badge key={r} variant="secondary" className="px-3 py-1 text-sm">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto w-full max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Întrebări frecvente</h2>
            <dl className="mt-8 flex flex-col gap-6">
              {FAQ.map((item) => (
                <div key={item.q} className="flex flex-col gap-1.5 border-t border-border pt-4">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-6 py-20 text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Intră printre primii
            </h2>
            <p className="max-w-md text-muted-foreground">
              Comunitate la început de drum. Adu-ți detaliile și vocea ta — construim standardul
              împreună.
            </p>
            {!authed && (
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/signup">Creează cont gratuit</Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-semibold tracking-tight text-foreground">DETALIA</span>
          <span>Comunitatea profesională din construcții · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
