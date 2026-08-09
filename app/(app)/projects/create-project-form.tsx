"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createProjectAction, type ProjectActionResult } from "./actions";

const INITIAL: ProjectActionResult = { ok: true };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2.5">
      <Input
        name="name"
        placeholder="Nume proiect (ex. Renovare bloc A)"
        maxLength={80}
        required
        className="max-w-[320px]"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Se creează…" : "Creează proiect"}
      </Button>
      {!state.ok && state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
