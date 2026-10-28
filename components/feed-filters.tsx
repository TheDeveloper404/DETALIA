"use client";
import { ListFilter, X } from "lucide-react";
import { startTransition, useId, useOptimistic, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearFeedFilters, feedFilterChips, type FeedFilterKey } from "@/lib/feed-filters";
import { ROLE_MAIN_LABELS } from "@/server/domain/roles";
import { DialogOverlay } from "./dialog-overlay";

const SHOW_OPTIONS: { key: FeedFilterKey; label: string; description: string }[] = [
  {
    key: "following",
    label: "Doar ce urmăresc",
    description: "Oamenii și categoriile pe care le urmărești",
  },
  { key: "unanswered", label: "Așteaptă ajutor", description: "Fără nicio schiță sau poziție încă" },
];

const SECTION_TITLE =
  "font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground";
const CHECKBOX = "size-[18px] flex-none accent-primary";

// Bara de control a feed-ului: cautarea + categoriile (randate de server) si meniul „Filtre".
export function FeedFilters({
  search,
  categoryFilter,
}: {
  search: React.ReactNode;
  categoryFilter: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bifa apare imediat; URL-ul real se actualizeaza abia dupa randarea pe server.
  const [params, setParams] = useOptimistic<URLSearchParams>(searchParams);
  const [open, setOpen] = useState(false);
  const id = useId();
  const chips = feedFilterChips(params);

  function navigate(next: URLSearchParams) {
    startTransition(() => {
      setParams(next);
      router.push("/feed?" + next.toString(), { scroll: false });
    });
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }

  return (
    <div className="mb-5 mt-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10">
        <div className="min-w-0 flex-1 basis-64">{search}</div>
        <div className="relative flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={chips.length ? `Filtre, ${chips.length} active` : "Filtre"}
            className={`flex h-11 flex-none items-center gap-2 rounded-lg border pl-4 pr-3.5 text-[14.5px] font-semibold transition-colors ${
              chips.length
                ? "border-primary bg-[#fbf1ea] text-[#8a4428]"
                : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <ListFilter className="size-4" strokeWidth={2} aria-hidden />
            Filtre
            {chips.length > 0 && (
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 font-mono text-xs text-primary-foreground">
                {chips.length}
              </span>
            )}
          </button>
          {open && (
            <DialogOverlay
              onClose={() => setOpen(false)}
              ariaLabel="Filtre"
              backdropClassName="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
              panelClassName="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card p-[18px] pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-1 ring-foreground/10 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[380px] sm:rounded-xl sm:shadow-[0_18px_40px_rgba(33,29,24,0.14)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">Filtre</span>
                <button
                  type="button"
                  onClick={() => navigate(clearFeedFilters(params))}
                  className="h-9 rounded-lg px-2.5 text-[13.5px] text-muted-foreground hover:bg-secondary"
                >
                  Resetează
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className={SECTION_TITLE}>Ce vezi</span>
                {SHOW_OPTIONS.map((o) => (
                  <div key={o.key} className="flex min-h-12 items-center gap-3">
                    <input
                      id={`${id}-${o.key}`}
                      type="checkbox"
                      checked={params.get(o.key) === "1"}
                      onChange={(e) => change(o.key, e.target.checked ? "1" : "")}
                      aria-describedby={`${id}-${o.key}-d`}
                      className={CHECKBOX}
                    />
                    <div className="flex flex-col">
                      <label htmlFor={`${id}-${o.key}`} className="cursor-pointer text-[14.5px] font-semibold">
                        {o.label}
                      </label>
                      <span id={`${id}-${o.key}-d`} className="text-[12.5px] text-muted-foreground">
                        {o.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              <div className="flex flex-col gap-2">
                <span className={SECTION_TITLE}>Autor</span>
                <label className="flex flex-col gap-1.5 text-[13.5px] text-muted-foreground">
                  Rol autor
                  <select
                    aria-label="Rol autor"
                    value={params.get("role") ?? ""}
                    onChange={(e) => change("role", e.target.value)}
                    className="min-h-11 rounded-lg border border-border bg-background px-2 text-[14.5px] text-foreground"
                  >
                    <option value="">Toate rolurile</option>
                    {Object.entries(ROLE_MAIN_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14.5px] font-semibold">
                  <input
                    type="checkbox"
                    checked={params.get("verified") === "1"}
                    onChange={(e) => change("verified", e.target.checked ? "1" : "")}
                    className={CHECKBOX}
                  />
                  Autor verificat
                </label>
              </div>

              <div className="h-px bg-border" />

              <div className="flex flex-col gap-1">
                <span className={SECTION_TITLE}>Conținut</span>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14.5px] font-semibold">
                  <input
                    type="checkbox"
                    checked={params.get("sketches") === "1"}
                    onChange={(e) => change("sketches", e.target.checked ? "1" : "")}
                    className={CHECKBOX}
                  />
                  Cu schițe
                </label>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 rounded-lg border border-[#95492e] bg-primary text-[15px] font-semibold text-primary-foreground sm:h-11 sm:text-[14.5px]"
              >
                <span className="sm:hidden">Arată detaliile</span>
                <span className="hidden sm:inline">Gata</span>
              </button>
            </DialogOverlay>
          )}
          {categoryFilter}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => change(c.key, "")}
              aria-label={`Scoate filtrul ${c.label}`}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-2 text-[13.5px] transition-colors hover:border-primary hover:text-primary"
            >
              {c.label}
              <X className="size-3.5" strokeWidth={2.2} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(clearFeedFilters(params))}
            className="h-[34px] rounded-lg px-2.5 text-[13.5px] text-muted-foreground underline hover:bg-secondary"
          >
            Șterge filtrele
          </button>
        </div>
      )}
    </div>
  );
}
