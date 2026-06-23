import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";

// Index preview dev — DOAR non-producție (vezi proxy.ts). A doua barieră: notFound() în prod.
export default function DevPreviewIndex() {
  if (process.env.NODE_ENV === "production") notFound();

  const links = [
    { href: "/dev/preview/feed", title: "Feed", body: "Lista de detalii din comunitate, cu date fictive." },
    { href: "/dev/preview/profile", title: "Profil", body: "Profil stil LinkedIn pentru construcții (verificat / neverificat)." },
    { href: "/dev/preview/sketch", title: "Schițare", body: "Editorul de schiță (unelte + culori + radieră + undo/redo)." },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6">
          <BrandLogo />
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preview dev · date mock
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Preview suprafețe</h1>
          <p className="text-sm text-muted-foreground">
            Vizualizare fără bază de date sau autentificare — date fictive, gated pe dev.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex flex-col gap-2 rounded-xl bg-card p-6 ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
            >
              <h2 className="font-semibold">{l.title}</h2>
              <p className="text-sm text-muted-foreground">{l.body}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
