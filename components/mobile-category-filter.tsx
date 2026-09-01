"use client";

// Filtrul de categorii pe mobil/tabletă (<1024px) — pe acele lățimi `FeedSidebar` e complet ascuns
// (`hidden lg:flex`), deci userii de pe telefon n-aveau NICIO cale de a filtra feed-ul pe categorie
// (audit static 2026-08-17). Buton + sheet de jos, reutilizează `CategoryFilterList` neschimbat.
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { CategoryFilterList, type SidebarCategory } from "./category-filter-list";
import { DialogOverlay } from "./dialog-overlay";

export function MobileCategoryFilter({
  categories,
  activeId,
  basePath,
  total,
  q = null,
  unanswered = false,
}: {
  categories: SidebarCategory[];
  activeId: string | null;
  basePath: string;
  total: number;
  q?: string | null;
  unanswered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeName = activeId ? categories.find((c) => c.id === activeId)?.name : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-11 flex-none items-center gap-1.5 rounded-lg bg-card px-3.5 text-[13.5px] font-medium text-foreground/80 ring-1 ring-foreground/10 lg:hidden"
      >
        <SlidersHorizontal className="size-4" strokeWidth={2} />
        {activeName ?? "Categorii"}
      </button>

      {open && (
        <DialogOverlay
          onClose={() => setOpen(false)}
          ariaLabel="Filtru categorii"
          panelClassName="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ring-1 ring-foreground/10 lg:hidden"
        >
          <div className="mb-1 flex items-center justify-between px-1 pb-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Categorii
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Închide"
              className="flex size-11 items-center justify-center rounded-lg text-foreground/60 hover:bg-secondary"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
          <CategoryFilterList
            categories={categories}
            activeId={activeId}
            basePath={basePath}
            total={total}
            q={q}
            unanswered={unanswered}
          />
        </DialogOverlay>
      )}
    </>
  );
}
