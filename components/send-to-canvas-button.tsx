"use client";

// „Trimite în Planșă" — popover ancorat pe cardul de feed / pagina detaliului. NU navighează afară (cerința
// UX §2.3): adaugă detaliul într-o planșă (existentă sau nou-creată inline) și rămâi unde ești; confirmare
// discretă cu link opțional „Deschide planșa". Lista planșelor se încarcă lazy la deschidere.
import { LayoutDashboard, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useSendToCanvas } from "@/components/use-send-to-canvas";

export function SendToCanvasButton({ detailId }: { detailId: string }) {
  const [open, setOpen] = useState(false);
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

  const openPopover = async () => {
    setOpen(true);
    await load();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <div className="group/canvas relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Trimite în Planșă"
        onClick={() => (open ? close() : void openPopover())}
        className="inline-flex items-center overflow-hidden rounded-full px-1.5 py-1 font-mono text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LayoutDashboard className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/canvas:ml-1.5 group-hover/canvas:max-w-[110px] group-hover/canvas:opacity-100">
          Trimite în Planșă
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-label="Trimite în Planșă"
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
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
