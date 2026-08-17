"use client";

import { LayoutDashboard, Loader2, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { DialogOverlay } from "@/components/dialog-overlay";
import { cn } from "@/lib/utils";

import { deleteCanvasShareAction, shareCanvasAction, type ProjectActionResult } from "../actions";

// Detaliu ÎNCĂ în proiect (privat) — SEC-005: NU trimitem `imageUrl` (URL Blob public) către client,
// doar `hasImage` (randăm prin proxy autenticat, /api/project-image/detail/[id], care verifică acces
// la fiecare cerere). Un URL brut ajuns în props ar fi accesibil oricui inspectează pagina, indiferent
// de ce randăm noi — proxy-ul devine inutil dacă URL-ul real circulă oricum.
export type ContentDetail = { id: string; title: string; hasImage: boolean };
// Detaliu SCOS în comunitate — public, la fel ca în feed; URL direct e OK aici.
export type ReleasedContentDetail = { id: string; title: string; imageUrl: string | null };
// Planșă partajată — la fel ca ContentDetail, fără `imageUrl` (proxy: /api/project-image/canvas-share/[id]).
export type ContentCanvasShare = {
  id: string;
  name: string;
  sharedByUserId: string;
  // Live (JOIN la citire), NU frozen — repară și partajările deja existente (2026-08-16, raportat:
  // planșa nu purta deloc numele autorului).
  sharedByUserName: string | null;
};
export type ContentCanvasOption = { id: string; name: string; thumbnailUrl: string | null };

const INITIAL: ProjectActionResult = { ok: true };
const TILE_CLASS =
  "group relative aspect-square overflow-hidden rounded-[14px] border border-[#e6ddcf] bg-[#efece6]";

// Grid matrice pentru Detalii + Planșe („pătrate mari", nu listă). „+" e prima celulă,
// deschide alegerea Creează detaliu / Adaugă planșă — înlocuiește butonul separat „Adaugă detaliu" de
// pe pagina veche.
export function ContentGrid({
  projectId,
  isMember,
  details,
  releasedDetails,
  canvasShares,
  myCanvases,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  isMember: boolean;
  details: ContentDetail[];
  releasedDetails: ReleasedContentDetail[];
  canvasShares: ContentCanvasShare[];
  myCanvases: ContentCanvasOption[];
  // Ștergerea unei partajări: cine a partajat-o SAU owner-ul proiectului — verificat REAL pe server;
  // aici doar arătăm/ascundem butonul (owner-ul proiectului vede pe toate, restul doar pe-ale lui).
  isOwner: boolean;
  currentUserId: string;
}) {
  const canManageShares = (sharedByUserId: string) => isOwner || sharedByUserId === currentUserId;

  const [addOpen, setAddOpen] = useState(false);

  const empty = details.length === 0 && canvasShares.length === 0 && releasedDetails.length === 0;

  return (
    <div>
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Detalii · Planșe
      </p>
      {empty && !isMember ? (
        <p className="rounded-[10px] border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
          Niciun conținut încă în acest proiect.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {isMember && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={cn(
                TILE_CLASS,
                "flex flex-col items-center justify-center gap-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary",
              )}
            >
              <Plus className="size-7" strokeWidth={1.8} />
              <span className="font-heading text-[13px] font-semibold">Adaugă</span>
            </button>
          )}

          {details.map((d) => (
            <Link key={d.id} href={`/details/${d.id}`} className={cn(TILE_CLASS, "block no-underline")}>
              {d.hasImage && (
                // SEC-005: proxy autenticat, NU URL Blob direct — verifică acces la fiecare cerere.
                // `unoptimized`: Next Image Optimization cache-uiește PUBLIC (per URL), ceea ce ar
                // bypassa poarta pentru un membru eliminat ulterior (vezi lib/project-image-proxy.ts).
                <Image
                  src={`/api/project-image/detail/${d.id}`}
                  alt=""
                  fill
                  unoptimized
                  sizes="240px"
                  className="object-cover"
                />
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[12px] font-semibold text-white">
                {d.title}
              </span>
            </Link>
          ))}

          {canvasShares.map((s) => (
            <CanvasShareTile
              key={s.id}
              share={s}
              canManage={canManageShares(s.sharedByUserId)}
            />
          ))}

          {releasedDetails.map((d) => (
            <Link
              key={d.id}
              href={`/details/${d.id}`}
              className={cn(TILE_CLASS, "block no-underline opacity-80 hover:opacity-100")}
            >
              {d.imageUrl && (
                <Image src={d.imageUrl} alt="" fill sizes="240px" className="object-cover" />
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white">
                În comunitate
              </span>
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[12px] font-semibold text-white">
                {d.title}
              </span>
            </Link>
          ))}
        </div>
      )}

      {addOpen && (
        <AddContentModal
          projectId={projectId}
          myCanvases={myCanvases}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// Planșa partajată e o COPIE ÎNGHEȚATĂ, needitabilă (§6B) — „intri" în ea ca lightbox (imaginea
// mărită), nu ca un editor. Înainte era un `<div>` simplu, fără link/click (bug real 2026-08-16,
// raportat: „doar previzualizare, nu pot să intru, doar șterge") — tiparul de lightbox e
// EXACT cel din `resource-image.tsx` (imagine de tip resursă), adaptat la proxy-ul autenticat.
function CanvasShareTile({
  share,
  canManage,
}: {
  share: ContentCanvasShare;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Escape închide — consecvent cu ConfirmDialog/ResourceImage (lightbox-ul e EXACT tiparul din
  // resource-image.tsx, i-a lipsit doar asta la introducere, 2026-08-16).
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
      <div className={TILE_CLASS}>
        {/* SEC-005: proxy autenticat — vezi comentariul de la `details` mai sus. Buton „cover" (nu
            un `<button>` extern înfășurător) — un `<button>` de ștergere ÎN INTERIORUL altui
            `<button>` ar fi HTML invalid; ăsta rămâne SIBLING, absolute deasupra, la fel ca înainte. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Vezi planșa: ${share.name}`}
          className="absolute inset-0 block"
        >
          <Image
            src={`/api/project-image/canvas-share/${share.id}`}
            alt=""
            fill
            unoptimized
            sizes="240px"
            className="object-cover"
          />
        </button>
        <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white">
          <LayoutDashboard className="size-3" strokeWidth={2} />
          Planșă
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[12px] font-semibold text-white">
          {share.name} · {share.sharedByUserName ?? "Anonim"}
        </span>
        {canManage && <DeleteShareButton shareId={share.id} />}
      </div>

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
            <Image
              src={`/api/project-image/canvas-share/${share.id}`}
              alt={`${share.name} · ${share.sharedByUserName ?? "Anonim"}`}
              fill
              unoptimized
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

function DeleteShareButton({ shareId }: { shareId: string }) {
  const [state, formAction, pending] = useActionState(deleteCanvasShareAction, INITIAL);
  return (
    <form action={formAction} className="absolute right-1.5 top-1.5">
      <input type="hidden" name="shareId" value={shareId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Șterge partajarea"
        className="inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/70 disabled:opacity-60 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" strokeWidth={2} />
      </button>
      {!state.ok && state.error && (
        <span className="sr-only" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

// Alegerea de la „+": Creează un detaliu ÎN proiect (link direct la formularul existent) sau Adaugă
// planșă (dintre planșele PROPRII — planșa nu se creează în proiect, e adusă din contul personal).
function AddContentModal({
  projectId,
  myCanvases,
  onClose,
}: {
  projectId: string;
  myCanvases: ContentCanvasOption[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"choice" | "canvas">("choice");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share(canvasId: string) {
    setBusyId(canvasId);
    setError(null);
    const fd = new FormData();
    fd.set("canvasId", canvasId);
    fd.set("projectId", projectId);
    const res = await shareCanvasAction(INITIAL, fd);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error ?? "Nu am putut partaja planșa.");
      return;
    }
    onClose();
  }

  return (
    <DialogOverlay
      onClose={onClose}
      ariaLabel="Adaugă în proiect"
      panelClassName="fixed left-1/2 top-1/2 z-50 w-[min(24rem,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <span className="text-sm font-semibold">
          {mode === "choice" ? "Adaugă în proiect" : "Alege o planșă"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      {mode === "choice" ? (
          <div className="flex flex-col gap-1.5 p-3">
            <Link
              href={`/details/new?projectId=${projectId}`}
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13.5px] font-semibold text-foreground no-underline hover:bg-muted"
            >
              <Plus className="size-4 text-primary" strokeWidth={2} />
              Creează un detaliu în proiect
            </Link>
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13.5px] font-semibold text-foreground hover:bg-muted"
            >
              <LayoutDashboard className="size-4 text-primary" strokeWidth={2} />
              Adaugă planșă
            </button>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto p-1.5">
            {myCanvases.length === 0 ? (
              <p className="p-3 font-mono text-[12px] text-muted-foreground">
                Nu ai nicio planșă salvată încă.
              </p>
            ) : (
              myCanvases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void share(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-muted disabled:opacity-50"
                >
                  {busyId === c.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <LayoutDashboard className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  )}
                  <span className="truncate">{c.name}</span>
                </button>
              ))
            )}
            {error && <p className="px-2.5 py-1.5 font-mono text-[11px] text-destructive">{error}</p>}
          </div>
        )}
    </DialogOverlay>
  );
}
