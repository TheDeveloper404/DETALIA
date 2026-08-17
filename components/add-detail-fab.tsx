"use client";

import { FolderPlus, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// CTA principal al platformei — fix pe ecran (nu în flow-ul unei coloane), ca să rămână mereu
// accesibil indiferent de scroll sau de câte categorii sunt expandate în sidebar (vezi CHANGELOG).
// Ascuns pe paginile de adăugare (`/details/new`, `/projects`) — n-are sens CTA-ul acolo unde ești
// deja pe formularul respectiv sau pe spațiul de proiecte.
export function AddDetailFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pathname === "/details/new" || pathname === "/projects") return null;

  return (
    <div ref={rootRef} className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Adaugă"
        title="Adaugă"
        data-tour="add"
        className="inline-flex items-center gap-2 rounded-full border border-[#95492e] bg-primary px-5 py-3.5 font-semibold text-primary-foreground no-underline shadow-lg transition-colors hover:bg-[#974a2e]"
      >
        <Plus className="size-[18px]" strokeWidth={2.4} />
        <span className="hidden sm:inline">Adaugă</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <Link
            href="/details/new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
          >
            <Plus className="size-4 text-muted-foreground" strokeWidth={2} />
            Adaugă detaliu
          </Link>
          <Link
            href="/projects"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
          >
            <FolderPlus className="size-4 text-muted-foreground" strokeWidth={2} />
            Începe proiect
          </Link>
        </div>
      )}
    </div>
  );
}
