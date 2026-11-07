"use client";

import { DialogOverlay } from "@/components/dialog-overlay";

import { UserStatusButton } from "./user-status-button";
import {
  STATUS_LABELS,
  VERIFICATION_LABELS,
  fmtDay,
  fullNameOf,
  isInactive,
  lastSeenLabel,
  roleLabelOf,
  type AdminUser,
} from "./users-table.utils";

// Fisa userului, panou lateral peste lista (lista ramane in spate, cu filtrele ei).
export function UserDetail({
  user,
  referrer,
  now,
  onClose,
  onOpenUser,
}: {
  user: AdminUser;
  referrer: AdminUser | null;
  now: Date;
  onClose: () => void;
  onOpenUser: (id: string) => void;
}) {
  const name = fullNameOf(user) || "—";
  return (
    <DialogOverlay
      onClose={onClose}
      ariaLabel={`Fișa userului ${name}`}
      backdropClassName="fixed inset-0 z-40 bg-black/30"
      panelClassName="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{name}</h2>
          <p className="break-all font-mono text-[13px] text-muted-foreground">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
        >
          Închide
        </button>
      </div>

      <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
        <dt className="text-muted-foreground">Status</dt>
        <dd>{STATUS_LABELS[user.status] ?? user.status}</dd>
        <dt className="text-muted-foreground">Rol</dt>
        <dd>{roleLabelOf(user) || "Onboarding neterminat"}</dd>
        <dt className="text-muted-foreground">Verificare</dt>
        <dd>{user.verification ? (VERIFICATION_LABELS[user.verification] ?? user.verification) : "—"}</dd>
        <dt className="text-muted-foreground">Județ</dt>
        <dd>{user.county ?? "—"}</dd>
      </dl>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Istoric</h3>
        <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-muted-foreground">Înscris</dt>
          <dd className="font-mono">{fmtDay(user.createdAt)}</dd>
          <dt className="text-muted-foreground">Adus de</dt>
          <dd>
            {referrer ? (
              <button type="button" onClick={() => onOpenUser(referrer.id)} className="text-primary hover:underline">
                {fullNameOf(referrer) || referrer.email}
              </button>
            ) : (
              "înscriere directă"
            )}
          </dd>
          <dt className="text-muted-foreground">Ultima activitate</dt>
          <dd className={isInactive(user, now) ? "text-[#9a6a12]" : ""}>
            {lastSeenLabel(user.lastSeenAt, now)}
            {user.lastSeenAt && ` · ${fmtDay(user.lastSeenAt)}`}
          </dd>
        </dl>
      </div>

      {user.status !== "DELETED" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Acțiuni</h3>
          <div>
            <UserStatusButton
              userId={user.id}
              email={user.email}
              status={user.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"}
            />
          </div>
        </div>
      )}
    </DialogOverlay>
  );
}
