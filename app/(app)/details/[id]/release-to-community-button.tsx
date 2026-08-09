"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { releaseToCommunityAction, type ProjectActionResult } from "@/app/(app)/projects/actions";

const INITIAL: ProjectActionResult = { ok: true };

// „Scoate în comunitate" — ireversibil (vezi server/domain/project.ts, canReleaseToCommunity).
// Vizibil doar când server-ul a confirmat DEJA dreptul (regula „orfan") — vezi page.tsx.
export function ReleaseToCommunityButton({ detailId }: { detailId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(releaseToCommunityAction, INITIAL);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Scoate în comunitate
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="detailId" value={detailId} />
      <p className="text-sm text-muted-foreground">
        Ireversibil — detaliul devine public, vizibil tuturor, nu doar membrilor proiectului. Sigur?
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se scoate…" : "Da, scoate în comunitate"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Anulează
        </Button>
      </div>
      {!state.ok && state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
