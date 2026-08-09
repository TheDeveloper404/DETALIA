"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { joinProjectAction, type JoinActionResult } from "./actions";

const INITIAL: JoinActionResult = { ok: true };

export function JoinButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(joinProjectAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={pending}>
        {pending ? "Se alătură…" : "Alătură-te proiectului"}
      </Button>
      {!state.ok && state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
