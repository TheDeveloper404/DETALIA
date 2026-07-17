"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/app/(app)/profile/actions";

// Meniul utilizatorului din header (avatar → dropdown). Vizualizare profil + Deconectare (reală, via signOut).
export function UserMenu({
  name,
  image,
  isFurnizor,
}: {
  name: string | null;
  image: string | null;
  isFurnizor: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  // Header-ul persistă între navigări (layout) → închide meniul la schimbarea rutei.
  // Ajustare de state în timpul render-ului (nu efect) — pattern-ul recomandat de React pentru asta.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Închidere la click în afară + Escape. NU folosim backdrop `fixed` (ca la kebab) fiindcă header-ul are
  // `backdrop-blur` → devine containing block pentru `fixed`, iar backdrop-ul n-ar acoperi tot ecranul.
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Meniul tău"
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initial}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
            {name && (
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              </div>
            )}
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
            >
              Vizualizare profil
            </Link>
            <Link
              href="/saved"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
            >
              Detalii salvate
            </Link>
            {isFurnizor && (
              <Link
                href="/my-offers"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
              >
                Ofertele mele
              </Link>
            )}
            <Link
              href="/sketches/drafts"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
            >
              Ciornele mele
            </Link>
            <Link
              href="/canvases"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-muted"
            >
              Planșele mele
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-3.5 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                Deconectare
              </button>
            </form>
        </div>
      )}
    </div>
  );
}
