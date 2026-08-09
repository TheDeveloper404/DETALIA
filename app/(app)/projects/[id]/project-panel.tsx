"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

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

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteProjectAction, INITIAL);

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
        Șterge proiectul
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <p className="text-sm text-destructive">
        Ireversibil — detaliile ÎNCĂ în proiect dispar cu tot ce au acumulat. Cele deja scoase în
        comunitate rămân neatinse. Sigur?
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Se șterge…" : "Da, șterge definitiv"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Anulează
        </Button>
      </div>
      {!state.ok && state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
