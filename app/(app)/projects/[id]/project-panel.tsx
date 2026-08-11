"use client";

import { MoreVertical, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import {
  deleteProjectAction,
  regenerateInviteLinkAction,
  removeMemberAction,
  type ProjectActionResult,
} from "../actions";

const INITIAL: ProjectActionResult = { ok: true };

export function InviteLinkBox({ projectId, initialToken }: { projectId: string; initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `window.location.origin` e un sistem EXTERN lui React (nu există pe server) — useSyncExternalStore
  // (nu useEffect+setState) citește-l corect din prima la hidratare, fără mismatch și fără re-render
  // suplimentar (același pattern ca `components/published-time.tsx`).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = origin ? `${origin}/projects/join/${token}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/join/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponibil — ignorăm silențios.
    }
  }

  async function regenerate() {
    setPending(true);
    setError(null);
    const res = await regenerateInviteLinkAction(projectId);
    setPending(false);
    if (!res.ok || !res.inviteToken) {
      setError(res.error ?? "Nu am putut regenera linkul.");
      return;
    }
    setToken(res.inviteToken);
  }

  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Link de invitație
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="max-w-full break-all rounded-md bg-muted px-2.5 py-1.5 text-xs">{url}</code>
        <Button type="button" variant="outline" onClick={copyLink}>
          {copied ? "Copiat" : "Copiază"}
        </Button>
        <Button type="button" variant="outline" onClick={regenerate} disabled={pending}>
          {pending ? "Se regenerează…" : "Regenerează"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Regenerarea invalidează instant linkul vechi — oricine îl mai are nu se mai poate alătura cu el.
      </p>
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function RemoveMemberButton({
  projectId,
  targetUserId,
}: {
  projectId: string;
  targetUserId: string;
}) {
  const [state, formAction, pending] = useActionState(removeMemberAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "…" : "Elimină"}
      </Button>
      {!state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

// Meniul de acțiuni al proiectului (kebab „⋮") — DOAR owner-ul îl vede (verificat de apelant). „Șterge
// proiectul" mutat aici (era buton de sine stătător pe pagină, prea vizibil), la fel ca
// „Acțiuni detaliu" pe pagina de detaliu: ștergerea ireversibilă stă într-un meniu, nu la vedere directă.
export function ProjectMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteProjectAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="relative">
      <form action={formAction} ref={formRef} className="hidden" aria-hidden>
        <input type="hidden" name="projectId" value={projectId} />
      </form>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acțiuni proiect"
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <MoreVertical className="size-[18px]" strokeWidth={2} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" strokeWidth={2} />
              Șterge proiectul
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Ștergi proiectul definitiv?"
        message="Ireversibil — detaliile ÎNCĂ în proiect dispar cu tot ce au acumulat. Cele deja scoase în comunitate rămân neatinse."
        confirmLabel={pending ? "Se șterge…" : "Da, șterge definitiv"}
        onConfirm={() => {
          // Închidem ÎNAINTE de submit (nu după) — la eșec (RATE_LIMITED/NOT_FOUND/FORBIDDEN), altfel
          // overlay-ul modal ar rămâne peste mesajul de eroare, blocat, fără explicație vizibilă.
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      {!state.ok && state.error && (
        <p className="absolute right-0 top-full mt-1 w-56 text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

// Buton „Invită membri" — link-ul e ascuns în spatele lui (era o bară de text expusă direct pe pagină,
// pe toată lățimea ei). Conținutul (InviteLinkBox) rămâne identic, doar modal.
export function InviteMembersButton({
  projectId,
  initialToken,
}: {
  projectId: string;
  initialToken: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" strokeWidth={2} />
        Invită membri
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Invită membri"
            className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Invită membri</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
            <InviteLinkBox projectId={projectId} initialToken={initialToken} />
          </div>
        </>
      )}
    </>
  );
}

export type ProjectMember = {
  userId: string;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verified: boolean;
};

const VISIBLE_MEMBERS_DEFAULT = 5;

// Listă tip „carte de vizită": poză + nume + rol (înainte arăta doar numele). Owner-ul
// apare PRIMUL, cu eticheta „Autor", indiferent dacă are și rând în project_members. Primii 5, cu
// „Arată toți membrii" dacă sunt mai mulți.
export function MembersList({
  owner,
  members,
  isOwner,
  projectId,
}: {
  owner: ProjectMember;
  members: ProjectMember[];
  isOwner: boolean;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Owner-ul poate avea și rând în project_members (ex. a plecat și s-a re-alăturat) — nu-l dublăm.
  const others = members.filter((m) => m.userId !== owner.userId);
  const visible = expanded ? others : others.slice(0, VISIBLE_MEMBERS_DEFAULT);

  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Membri ({others.length + 1})
      </p>
      <ul className="flex list-none flex-col gap-2.5 p-0">
        <MemberRow member={owner} badge="Autor" />
        {visible.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2">
            <MemberRow member={m} />
            {isOwner && <RemoveMemberButton projectId={projectId} targetUserId={m.userId} />}
          </li>
        ))}
      </ul>
      {others.length > VISIBLE_MEMBERS_DEFAULT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2.5 font-mono text-[12px] font-semibold text-primary hover:opacity-80"
        >
          {expanded ? "Arată mai puțini" : `Arată toți membrii (${others.length})`}
        </button>
      )}
    </div>
  );
}

function MemberRow({ member, badge }: { member: ProjectMember; badge?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AvatarInitials name={member.name} imageUrl={member.image} size={32} />
      <div className="min-w-0">
        <Link
          href={`/profile/${member.userId}`}
          className="block truncate text-sm font-semibold text-foreground hover:underline"
        >
          {member.name ?? "Anonim"}
        </Link>
        <div className="flex items-center gap-1.5">
          <RolePill roleMain={member.roleMain} subRole={member.subRole} verified={member.verified} />
          {badge && (
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
