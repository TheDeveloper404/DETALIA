"use client";

import { Loader2, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { getFollowedUsersAction } from "@/app/(app)/following/actions";
import type { FollowedUsersPage } from "@/server/services/followService";
import { AvatarInitials } from "./avatar-initials";
import { DialogOverlay } from "./dialog-overlay";
import { RolePill } from "./role-pill";
import { ShowMoreButton } from "./show-more-button";

export function FollowingUsersButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground/80 transition-colors hover:border-primary hover:text-primary">
        <Users className="size-4" aria-hidden /> Persoane urmărite
      </button>
      {open && createPortal(<FollowingUsersModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function FollowingUsersModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<FollowedUsersPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const load = useCallback((cursor: string | null) => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getFollowedUsersAction(cursor);
        if (!result.ok) { setError(result.error); return; }
        setPage((current) => ({ users: cursor && current ? [...current.users, ...result.users] : result.users, nextCursor: result.nextCursor }));
      } catch {
        setError("Lista nu s-a putut încărca. Încearcă din nou.");
      }
    });
  }, []);
  useEffect(() => { load(null); }, [load]);

  return (
    <DialogOverlay onClose={onClose} ariaLabel="Persoane urmărite" backdropClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" panelClassName="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">Persoane urmărite</h2>
        <button type="button" onClick={onClose} aria-label="Închide persoanele urmărite" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>
      </div>
      <div className="max-h-[60dvh] overflow-y-auto p-4">
        {pending && <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Se încarcă…</p>}
        {page?.users.length === 0 && !pending && <p className="py-3 text-sm text-muted-foreground">Nu urmărești încă nicio persoană.</p>}
        {page && page.users.length > 0 && (
          <ul className="divide-y divide-border">
            {page.users.map((user) => (
              <li key={user.id}>
                <Link href={`/profile/${user.id}`} onClick={onClose} className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg py-2 hover:bg-secondary">
                  <AvatarInitials name={user.name} imageUrl={user.image} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user.name ?? "Anonim"}</span>
                  <RolePill roleMain={user.roleMain} subRole={user.subRole} verified={user.verification === "VERIFIED"} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {!pending && error ? (
          <button type="button" onClick={() => load(page?.nextCursor ?? null)} className="mt-3 min-h-11 rounded-lg border border-border px-3 text-sm font-semibold">Încearcă din nou</button>
        ) : !pending && page?.nextCursor ? <ShowMoreButton onClick={() => load(page.nextCursor)} /> : null}
      </div>
    </DialogOverlay>
  );
}
