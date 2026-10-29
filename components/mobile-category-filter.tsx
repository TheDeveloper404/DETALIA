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
  activeIds,
  basePath,
  total,
  q = null,
  unanswered = false,
  filterQuery = "",
}: {
  categories: SidebarCategory[];
  activeIds: string[];
  basePath: string;
  total: number;
  q?: string | null;
  unanswered?: boolean;
  filterQuery?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeName = activeIds.length === 1 ? categories.find((c) => c.id === activeIds[0])?.name : null;
  const label = activeName ?? (activeIds.length > 1 ? `${activeIds.length} categorii` : "Categorii");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
        className={`flex h-11 w-11 flex-none items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-medium ring-1 sm:w-auto sm:px-3.5 lg:hidden ${
          activeIds.length
            ? "bg-[#fbf1ea] text-[#8a4428] ring-primary"
            : "bg-card text-foreground/80 ring-foreground/10"
        }`}
      >
        <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">{label}</span>
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
            activeIds={activeIds}
            basePath={basePath}
            total={total}
            q={q}
            unanswered={unanswered}
            filterQuery={filterQuery}
          />
        </DialogOverlay>
      )}
    </>
  );
}
