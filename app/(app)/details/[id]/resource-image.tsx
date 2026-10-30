"use client";

import { ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

// Resursa imagine: control compact; clickul pastreaza lightbox-ul existent.
export function ResourceImage({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-primary"
        aria-label={`Mărește imaginea: ${alt}`}
      >
        <ImageIcon className="size-3.5" strokeWidth={1.8} aria-hidden />
        Imagine
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Închide"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          <div className="relative h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={url} unoptimized={url.startsWith("/api/")} alt={alt} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
