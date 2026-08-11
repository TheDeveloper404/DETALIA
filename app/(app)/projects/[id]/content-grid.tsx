"use client";

import { LayoutDashboard, Loader2, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { cn } from "@/lib/utils";

import { deleteCanvasShareAction, shareCanvasAction, type ProjectActionResult } from "../actions";

export type ContentDetail = { id: string; title: string; imageUrl: string | null };
export type ContentCanvasShare = { id: string; name: string; imageUrl: string; sharedByUserId: string };
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
  canManageShares,
}: {
  projectId: string;
  isMember: boolean;
  details: ContentDetail[];
  releasedDetails: ContentDetail[];
  canvasShares: ContentCanvasShare[];
  myCanvases: ContentCanvasOption[];
  // Ștergerea unei partajări: cine a partajat-o SAU owner-ul proiectului — verificat REAL pe server;
  // aici doar arătăm/ascundem butonul (owner-ul proiectului vede pe toate, restul doar pe-ale lor).
  canManageShares: (sharedByUserId: string) => boolean;
}) {
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
              {d.imageUrl && (
                <Image src={d.imageUrl} alt="" fill sizes="240px" className="object-cover" />
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[12px] font-semibold text-white">
                {d.title}
              </span>
            </Link>
          ))}

          {canvasShares.map((s) => (
            <div key={s.id} className={TILE_CLASS}>
              <Image src={s.imageUrl} alt="" fill sizes="240px" className="object-cover" />
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white">
                <LayoutDashboard className="size-3" strokeWidth={2} />
                Planșă
              </span>
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[12px] font-semibold text-white">
                {s.name}
              </span>
              {canManageShares(s.sharedByUserId) && (
                <DeleteShareButton projectId={projectId} shareId={s.id} />
              )}
            </div>
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

function DeleteShareButton({ projectId, shareId }: { projectId: string; shareId: string }) {
  const [state, formAction, pending] = useActionState(deleteCanvasShareAction, INITIAL);
  return (
    <form action={formAction} className="absolute right-1.5 top-1.5">
      <input type="hidden" name="projectId" value={projectId} />
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
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Adaugă în proiect"
        className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
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
      </div>
    </>
  );
}
