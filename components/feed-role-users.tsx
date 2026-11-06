"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { getRoleDirectoryPageAction } from "@/app/(app)/feed/actions";
import type { RoleDirectoryCursor } from "@/server/services/detailService";
import { AvatarInitials } from "./avatar-initials";
import { DialogOverlay } from "./dialog-overlay";
import { ShowMoreButton } from "./show-more-button";

type RoleDirectoryUser = {
  id: string;
  name: string | null;
  image: string | null;
  subRole: string | null;
  detailCount: number;
};

function UserRow({ user }: { user: RoleDirectoryUser }) {
  return (
    <li className="min-w-0">
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
  );
}

export function FeedRoleUsers({
  role,
  roleLabel,
  county = null,
  total,
  users,
}: {
  role: string;
  roleLabel: string;
  county?: string | null;
  total: number;
  users: RoleDirectoryUser[];
}) {
  const [open, setOpen] = useState(false);
  const title = county ? `Utilizatori din ${roleLabel} · ${county}` : `Utilizatori din ${roleLabel}`;
  const count = `${total} ${total === 1 ? "utilizator" : "utilizatori"}`;

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
            <ul className="mt-3 grid list-none grid-cols-2 gap-x-4 p-0">
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nu există utilizatori cu acest rol.</p>
          )}
          {total > users.length && (
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
        <RoleUsersModal role={role} county={county} title={title} count={count} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function RoleUsersModal({
  role,
  county,
  title,
  count,
  onClose,
}: {
  role: string;
  county: string | null;
  title: string;
  count: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState<{ users: RoleDirectoryUser[]; nextCursor: RoleDirectoryCursor | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Un al doilea click venit inainte ca `pending` sa ascunda butonul ar cere aceeasi pagina de doua ori.
  const loading = useRef(false);
  const load = useCallback(
    (cursor: RoleDirectoryCursor | null) => {
      if (loading.current) return;
      loading.current = true;
      startTransition(async () => {
        setError(null);
        try {
          const result = await getRoleDirectoryPageAction(role, county, cursor);
          if (!result.ok) { setError(result.error); return; }
          setPage((current) => ({
            users: cursor && current ? [...current.users, ...result.users] : result.users,
            nextCursor: result.nextCursor,
          }));
        } catch {
          setError("Lista nu s-a putut încărca. Încearcă din nou.");
        } finally {
          loading.current = false;
        }
      });
    },
    [role, county],
  );
  useEffect(() => { load(null); }, [load]);

  return (
    <DialogOverlay
      onClose={onClose}
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
          onClick={onClose}
          aria-label="Închide"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <X className="size-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="mt-3 min-h-0 overflow-y-auto">
        {page && page.users.length > 0 && (
          <ul className="list-none divide-y divide-border p-0">
            {page.users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </ul>
        )}
        {page?.users.length === 0 && !pending && (
          <p className="text-sm text-muted-foreground">Nu există utilizatori cu acest rol.</p>
        )}
        {pending && (
          <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Se încarcă…
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {!pending && error ? (
          <button
            type="button"
            onClick={() => load(page?.nextCursor ?? null)}
            className="mt-3 min-h-11 rounded-lg border border-border px-3 text-sm font-semibold"
          >
            Încearcă din nou
          </button>
        ) : !pending && page?.nextCursor ? (
          <ShowMoreButton onClick={() => load(page.nextCursor)} />
        ) : null}
      </div>
    </DialogOverlay>
  );
}
