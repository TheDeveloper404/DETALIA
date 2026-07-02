"use client";

import { Bookmark, BookmarkCheck, Check, Link2, MoreVertical, Trash2, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { deleteDetailAction } from "./delete-actions";
import { toggleSaveDetailAction } from "./save-actions";

// Meniul de acțiuni al unui detaliu (kebab „⋮"). Ascunde ștergerea (ireversibilă) într-un meniu, ca să
// nu fie apăsată din greșeală (cerință Edi, 2026-07-02): Șterge stă ULTIMA, roșu, separată de restul.
// Vizibil tuturor: Salvează + Vezi profil autor + Copiază link. „Șterge detaliul" DOAR autorului (authz
// reală rămâne pe server, în deleteDetail). Pattern-ul de dropdown e cel din components/user-menu.tsx.
export function DetailActionsMenu({
  detailId,
  authorId,
  isAuthor,
  isSaved,
}: {
  detailId: string;
  authorId: string;
  isAuthor: boolean;
  isSaved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Închide meniul la schimbarea rutei (ajustare de state în render — pattern React recomandat).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponibil (permisiuni/context non-secure) — ignorăm silențios.
    }
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground no-underline transition-colors hover:bg-muted";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acțiuni detaliu"
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <MoreVertical className="size-[18px]" strokeWidth={2} />
      </button>

      {open && (
        <>
          {/* Backdrop transparent — închide la click în afară. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
          >
            {/* Salvează / Salvat — toggle bookmark. */}
            <form action={toggleSaveDetailAction}>
              <input type="hidden" name="detailId" value={detailId} />
              <button type="submit" role="menuitem" className={itemClass}>
                {isSaved ? (
                  <>
                    <BookmarkCheck className="size-4 text-primary" strokeWidth={2} />
                    Salvat
                  </>
                ) : (
                  <>
                    <Bookmark className="size-4 text-muted-foreground" strokeWidth={2} />
                    Salvează detaliul
                  </>
                )}
              </button>
            </form>

            {/* Vezi profilul autorului. */}
            <Link
              href={`/profile/${authorId}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <User className="size-4 text-muted-foreground" strokeWidth={2} />
              Vezi profilul autorului
            </Link>

            {/* Copiază linkul detaliului. */}
            <button type="button" role="menuitem" onClick={copyLink} className={itemClass}>
              {copied ? (
                <>
                  <Check className="size-4 text-primary" strokeWidth={2} />
                  Link copiat
                </>
              ) : (
                <>
                  <Link2 className="size-4 text-muted-foreground" strokeWidth={2} />
                  Copiază linkul
                </>
              )}
            </button>

            {/* Ștergere — DOAR autorul, ULTIMA, separată + roșie. Confirmare explicită (ireversibil). */}
            {isAuthor && (
              <>
                <div className="my-1 border-t border-border" aria-hidden />
                <form
                  action={deleteDetailAction}
                  onSubmit={(e) => {
                    if (
                      !window.confirm(
                        "Sigur ștergi acest detaliu? Schițele, validările și comentariile lui se șterg definitiv.",
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="detailId" value={detailId} />
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" strokeWidth={2} />
                    Șterge detaliul
                  </button>
                </form>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
