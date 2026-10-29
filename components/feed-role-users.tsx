"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AvatarInitials } from "./avatar-initials";
import { DialogOverlay } from "./dialog-overlay";

export function FeedRoleUsers({
  roleLabel,
  county = null,
  users,
}: {
  roleLabel: string;
  county?: string | null;
  users: {
    id: string;
    name: string | null;
    image: string | null;
    subRole: string | null;
    detailCount: number;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const title = county ? `Utilizatori din ${roleLabel} · ${county}` : `Utilizatori din ${roleLabel}`;
  const count = `${users.length} ${users.length === 1 ? "utilizator" : "utilizatori"}`;
  const items = users.map((user) => (
    <li key={user.id} className="min-w-0">
      <Link
        href={`/profile/${user.id}`}
        className="flex min-h-16 items-center gap-3 rounded-lg py-3 no-underline transition-colors hover:bg-secondary/60"
      >
        <AvatarInitials name={user.name} imageUrl={user.image} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {user.name ?? "Anonim"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{user.subRole}</span>
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {user.detailCount} {user.detailCount === 1 ? "detaliu" : "detalii"}
        </span>
      </Link>
    </li>
  ));

  return (
    <>
      <section aria-label={title} className="mb-5 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{count}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-end justify-end self-end text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline sm:hidden"
          >
            Afișează
          </button>
        </div>
        <div className="hidden sm:block">
          {users.length ? (
            <ul className="mt-3 grid list-none grid-cols-2 gap-x-4 p-0">{items.slice(0, 6)}</ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nu există utilizatori cu acest rol.</p>
          )}
          {users.length > 6 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="ml-auto mt-1 flex min-h-11 w-fit min-w-11 items-end justify-end text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Afișează
            </button>
          )}
        </div>
      </section>

      {open && (
        <DialogOverlay
          onClose={() => setOpen(false)}
          ariaLabel={title}
          panelClassName="fixed inset-x-4 top-1/2 z-50 flex max-h-[85vh] -translate-y-1/2 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:p-6"
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{count}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Închide"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="mt-3 min-h-0 overflow-y-auto">
            {users.length ? (
              <ul className="list-none divide-y divide-border p-0">{items}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nu există utilizatori cu acest rol.</p>
            )}
          </div>
        </DialogOverlay>
      )}
    </>
  );
}
