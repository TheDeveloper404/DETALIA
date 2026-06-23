import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";

import { SketchPreviewClient } from "./sketch-preview-client";

// Preview editor de schiță cu date mock (fără DB/auth). DOAR non-producție.
export default function DevSketchPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6">
          <BrandLogo href="/dev/preview" />
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preview · schițare
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <Link
          href="/dev/preview/feed"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Înapoi la feed
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Schițează peste „Atic acoperiș terasă”</h1>
          <p className="text-sm text-muted-foreground">
            Desenează cum ar trebui să arate. (Preview: salvarea și trimiterea sunt dezactivate — fără DB.)
          </p>
        </header>

        <SketchPreviewClient />
      </main>
    </div>
  );
}
