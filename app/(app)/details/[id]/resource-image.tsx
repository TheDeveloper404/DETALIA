"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

// Resursă de tip Imagine — thumbnail mic în listă, click → lightbox (imaginea mărită), nu link extern
// (2026-07-16, cerere Edi: „trebuie să apară imaginea propriu-zisă, nu link preview ca și acum").
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
        className="relative size-[52px] flex-none overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary"
        aria-label={`Mărește imaginea: ${alt}`}
      >
        <Image src={url} alt={alt} fill sizes="52px" className="object-cover" />
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
            <Image src={url} alt={alt} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
