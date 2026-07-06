"use client";

import { Bookmark, BookmarkCheck, Check, LayoutDashboard, Link2, MoreVertical, Pencil, Trash2, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SendToCanvasModal } from "@/components/send-to-canvas-modal";

import { deleteDetailAction } from "./delete-actions";
import { deleteSketchAction } from "./sketch-review-actions";
import { toggleSaveDetailAction } from "./save-actions";

// Meniul de acțiuni al unui detaliu (kebab „⋮"). Ascunde ștergerea (ireversibilă) într-un meniu, ca să
// nu fie apăsată din greșeală (cerință Edi, 2026-07-02): Șterge stă ULTIMA, roșu, separată de restul.
// Vizibil tuturor: Salvează + Vezi profil autor + Copiază link. „Șterge detaliul" DOAR autorului (authz
// reală rămâne pe server, în deleteDetail). Pattern-ul de dropdown e cel din components/user-menu.tsx.
// 2026-07-06: unificat AICI toate acțiunile care înainte erau împrăștiate lângă panoul din dreapta al
// tabului de schiță (copiază link public schiță, șterge schița mea) + „Trimite în Planșă" (înainte doar
// pe tabul de bază) — un singur loc pentru toate acțiunile, indiferent de tab.
// 2026-07-06: scos linkul PRIVAT (pagina curentă) — decizie Liviu: între useri cu cont, link-ul se
// trimite din bara de adresă a browser-ului, nu are nevoie de buton dedicat. Rămâne DOAR linkul PUBLIC
// al schiței (`/s/[id]`, fără cont) — pentru asta există, ca să poți trimite unui prieten fără cont.
// Detaliul de bază nu are variantă publică → nu are niciun item de „copiază link" în meniu.
export function DetailActionsMenu({
  detailId,
  authorId,
  isAuthor,
  isSaved,
  canSendToCanvas,
  activeSketchPublicId,
  canDeleteActiveSketch,
  deleteSketchLabel,
}: {
  detailId: string;
  authorId: string;
  isAuthor: boolean;
  isSaved: boolean;
  // „Trimite în Planșă" — vizibil doar când userul e logat ȘI modelul CanvasItem poate reprezenta corect
  // ce vede userul acum (doar tab de bază; pe schiță ar trimite silențios detaliul-mamă, nu schița).
  canSendToCanvas?: boolean;
  // Link public al schiței active (`/s/[id]`, fără cont) — singurul link din meniu; vizibil doar pe tab
  // de schiță (id-ul schiței active, null pe tab de bază).
  activeSketchPublicId?: string | null;
  canDeleteActiveSketch?: boolean;
  deleteSketchLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sketchLinkCopied, setSketchLinkCopied] = useState(false);
  const [sendToCanvasOpen, setSendToCanvasOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Închide meniul la schimbarea rutei (ajustare de state în render — pattern React recomandat).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  async function copySketchLink() {
    if (!activeSketchPublicId) return;
    try {
      const url = `${window.location.origin}/s/${activeSketchPublicId}`;
      await navigator.clipboard.writeText(url);
      setSketchLinkCopied(true);
      setTimeout(() => setSketchLinkCopied(false), 1500);
    } catch {
      // clipboard indisponibil — ignorăm silențios.
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

            {/* Trimite în Planșă — doar dacă modelul poate reprezenta corect ce vede userul (tab de bază). */}
            {canSendToCanvas && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setSendToCanvasOpen(true);
                }}
                className={itemClass}
              >
                <LayoutDashboard className="size-4 text-muted-foreground" strokeWidth={2} />
                Trimite în Planșă
              </button>
            )}

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

            {/* Copiază linkul PUBLIC al schiței (`/s/[id]`, fără cont) — doar pe tab de schiță. Singurul
                link din meniu (vezi nota din antetul fișierului). */}
            {activeSketchPublicId && (
              <button
                type="button"
                role="menuitem"
                onClick={copySketchLink}
                title="Link public, vizibil și fără cont"
                className={itemClass}
              >
                {sketchLinkCopied ? (
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
            )}

            {/* Editează — DOAR autorul. Duce la formularul de editare (ownership re-verificat pe server). */}
            {isAuthor && (
              <Link
                href={`/details/${detailId}/edit`}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Pencil className="size-4 text-muted-foreground" strokeWidth={2} />
                Editează detaliul
              </Link>
            )}

            {/* Ștergere — ULTIMA, separată + roșie. Confirmare explicită (ireversibil). */}
            {(canDeleteActiveSketch || isAuthor) && <div className="my-1 border-t border-border" aria-hidden />}

            {/* Șterge schița activă — autorul detaliului (moderare) SAU autorul schiței. */}
            {canDeleteActiveSketch && (
              <form
                action={deleteSketchAction}
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      "Sigur ștergi această schiță? Validările și comentariile ei se șterg definitiv.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="sketchId" value={activeSketchPublicId ?? ""} />
                <input type="hidden" name="detailId" value={detailId} />
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" strokeWidth={2} />
                  {deleteSketchLabel ?? "Șterge schița mea"}
                </button>
              </form>
            )}

            {isAuthor && (
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
            )}
          </div>
        </>
      )}

      {sendToCanvasOpen && (
        <SendToCanvasModal detailId={detailId} onClose={() => setSendToCanvasOpen(false)} />
      )}
    </div>
  );
}
