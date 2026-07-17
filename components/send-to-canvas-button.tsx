"use client";

// „Trimite în Planșă" — popover ancorat pe cardul de feed / pagina detaliului. NU navighează afară (cerința
// UX §2.3): adaugă detaliul într-o planșă (existentă sau nou-creată inline) și rămâi unde ești; confirmare
// discretă cu link opțional „Deschide planșa". Lista planșelor se încarcă lazy la deschidere.
//
// Poziționare orizontală CALCULATĂ (nu doar `right-0` static) — decizie Liviu 2026-07-17: popover-ul
// trebuie să rămână IDENTIC ca stil pe desktop (nu modal centrat cu backdrop) și să funcționeze corect
// și pe mobil, nu înlocuit cu alt shell de UI. Bug-ul original (popover tăiat pe ecrane mobile) venea din
// ancorarea fixă `right-0` — acum poziția se calculează la deschidere (`getBoundingClientRect` + lățimea
// ferestrei) și se clampează să rămână mereu complet vizibil, indiferent unde e butonul pe card. Pe
// desktop rezultatul calculului coincide cu vechiul `right-0` (spațiu suficient → fără clamping).
import { LayoutDashboard, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { useSendToCanvas } from "@/components/use-send-to-canvas";

const POPOVER_WIDTH = 256; // w-64
const VIEWPORT_MARGIN = 8;

export function SendToCanvasButton({ detailId }: { detailId: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offsetLeft, setOffsetLeft] = useState<number | null>(null);
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
    reset,
  } = useSendToCanvas(detailId);

  // Recalculează poziția la fiecare deschidere (+ la resize cât timp e deschis, ex. rotire mobil).
  // useLayoutEffect (nu useEffect) — rulează înainte de vopsire, deci fără flash de poziție greșită.
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;

    function reposition() {
      const rect = wrapperRef.current!.getBoundingClientRect();
      const desiredViewportLeft = rect.right - POPOVER_WIDTH; // implicit: aliniat la dreapta butonului
      // Math.max aici (nu doar scăderea directă) — pe un viewport mai îngust decât
      // POPOVER_WIDTH + 2*VIEWPORT_MARGIN, limita superioară ar cădea SUB cea inferioară și ar inversa
      // clampul (Math.min ar întoarce mereu limita superioară, ignorând marginea din stânga).
      const maxViewportLeft = Math.max(window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
      const clampedViewportLeft = Math.min(Math.max(desiredViewportLeft, VIEWPORT_MARGIN), maxViewportLeft);
      setOffsetLeft(clampedViewportLeft - rect.left);
    }

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  const openPopover = async () => {
    setOpen(true);
    await load();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <div ref={wrapperRef} className="group/canvas relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Trimite în Planșă"
        onClick={() => (open ? close() : void openPopover())}
        className="inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LayoutDashboard className="size-3.5 shrink-0" strokeWidth={2} />
        {/* Tooltip absolut (nu expandare inline) — nu împinge vecinii, consecvent cu „Schițează peste". */}
        <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[11px] text-background opacity-0 transition-opacity duration-150 group-hover/canvas:opacity-100">
          Trimite în Planșă
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-label="Trimite în Planșă"
            style={offsetLeft !== null ? { left: offsetLeft } : undefined}
            className="absolute top-full z-40 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            {added ? (
              <div className="p-3 text-[13px]">
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

                    {error && (
                      <p className="px-2.5 py-1.5 font-mono text-[11px] text-destructive">{error}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
