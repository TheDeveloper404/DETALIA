"use client";

// Conținutul „Trimite în Planșă" randat ca MODAL centrat, nu popover ancorat — folosit din kebab-ul
// detaliului (DetailActionsMenu), unde un popover ancorat pe itemul de meniu s-ar suprapune vizual cu
// dropdown-ul părinte (z-index/poziționare instabile). Logica e identică cu send-to-canvas-button.tsx,
// via hook-ul comun `useSendToCanvas`.
import { LayoutDashboard, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { useSendToCanvas } from "@/components/use-send-to-canvas";

export function SendToCanvasModal({
  detailId,
  sketchId,
  onClose,
}: {
  detailId: string;
  // Dat = trimite imaginea COMPUSĂ a acestei schițe (nu a detaliului-mamă).
  sketchId?: string | null;
  onClose: () => void;
}) {
  const {
    loading,
    canvases,
    busy,
    error,
    added,
    creating,
    newName,
    setNewName,
    setCreating,
    addToExisting,
    createAndAdd,
    load,
  } = useSendToCanvas(detailId, sketchId);

  // Modalul se montează DOAR când e deschis (rendat condiționat din kebab) → mount = momentul potrivit
  // să declanșeze încărcarea lazy a planșelor (echivalentul openPopover() din varianta ancorată).
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Trimite în Planșă"
        className="fixed left-1/2 top-1/2 z-50 w-[min(20rem,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-sm font-semibold">Trimite în Planșă</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {added ? (
          <div className="p-3.5 text-[13px]">
            <p className="mb-2">
              Adăugat în <span className="font-semibold">«{added.name}»</span>
            </p>
            <Link
              href={`/canvases/${added.canvasId}/edit`}
              className="font-mono text-[12px] text-primary underline underline-offset-2"
            >
              Deschide planșa →
            </Link>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Se încarcă…
              </div>
            ) : (
              <>
                {(canvases ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void addToExisting(c)}
                    className="flex w-full items-center gap-2 truncate rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-muted disabled:opacity-50"
                  >
                    <LayoutDashboard className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}

                {creating ? (
                  <div className="p-1.5">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createAndAdd();
                        if (e.key === "Escape") setCreating(false);
                      }}
                      maxLength={80}
                      placeholder="Nume planșă nouă"
                      disabled={busy}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
                    />
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCreating(false)}
                        className="rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        Renunță
                      </button>
                      <button
                        type="button"
                        onClick={() => void createAndAdd()}
                        disabled={busy || !newName.trim()}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[11px] text-primary-foreground disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : "Creează & adaugă"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-primary hover:bg-muted"
                  >
                    <Plus className="size-3.5 shrink-0" strokeWidth={2} />
                    Creează planșă nouă
                  </button>
                )}

                {error && <p className="px-2.5 py-1.5 font-mono text-[11px] text-destructive">{error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
