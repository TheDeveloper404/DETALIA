"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { DialogOverlay } from "@/components/dialog-overlay";
import { RolePill } from "@/components/role-pill";
import { cn } from "@/lib/utils";

export type SketchOverflowEntry = {
  id: string;
  label: string;
  avatarName: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verified: boolean;
  // „#N" pe schiță; null pe autorul retras.
  ordinal: number | null;
};

// Doar mobil: taburile schițelor stau în spatele unui buton cu numărul lor, care deschide lista schițelor.
export function SketchOverflowMenu({
  count,
  entries,
  activeId,
  onSelect,
}: {
  count: number;
  entries: SketchOverflowEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = `Toate schițele (${entries.length})`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Toate schițele (${count})`}
        className="flex h-7 min-w-9 flex-none items-center justify-center rounded-full border border-border bg-card px-2 font-mono text-xs text-muted-foreground sm:hidden"
      >
        {count}
      </button>

      {open && (
        <DialogOverlay
          onClose={() => setOpen(false)}
          ariaLabel={title}
          panelClassName="fixed inset-x-4 top-1/2 z-50 flex max-h-[85vh] -translate-y-1/2 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Închide"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <ul className="mt-2 min-h-0 list-none divide-y divide-border overflow-y-auto p-0">
            {entries.map((e) => {
              const active = e.id === activeId;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(e.id);
                      setOpen(false);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-lg px-1 py-2 text-left",
                      active ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <AvatarInitials name={e.avatarName} imageUrl={e.image} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{e.label}</span>
                    </span>
                    <span className="flex-none">
                      <RolePill roleMain={e.roleMain} subRole={e.subRole} verified={e.verified} />
                    </span>
                    {e.ordinal !== null && (
                      <span className="flex-none font-mono text-[11px] text-muted-foreground">#{e.ordinal}</span>
                    )}
                    {active && <Check className="size-4 flex-none text-primary" strokeWidth={2} aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogOverlay>
      )}
    </>
  );
}
