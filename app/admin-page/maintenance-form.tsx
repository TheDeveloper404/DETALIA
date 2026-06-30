"use client";

import { useActionState } from "react";

import { type MaintenanceFormState, setMaintenanceAction } from "./actions";

const INITIAL: MaintenanceFormState = { ok: false, error: null };

// Formularul de mentenanță (client). Toggle + dată anunțată + mesaj opțional. Validarea reală e pe server.
export function MaintenanceForm({
  defaults,
}: {
  defaults: { enabled: boolean; date: string | null; message: string | null };
}) {
  const [state, formAction, pending] = useActionState(setMaintenanceAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={defaults.enabled}
          className="mt-0.5 size-4 accent-foreground"
        />
        <span>
          <span className="block text-sm font-semibold">Mentenanță activă</span>
          <span className="block text-[13px] text-muted-foreground">
            Landing-ul arată „site în lucru&rdquo; vizitatorilor anonimi; userii logați văd un banner în feed.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium">
          Data anunțată <span className="text-muted-foreground">(opțional)</span>
        </label>
        <input
          id="date"
          type="date"
          name="date"
          defaultValue={defaults.date ?? ""}
          className="w-fit rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium">
          Mesaj banner <span className="text-muted-foreground">(opțional — înlocuiește textul implicit)</span>
        </label>
        <textarea
          id="message"
          name="message"
          maxLength={280}
          rows={2}
          defaultValue={defaults.message ?? ""}
          placeholder="ex. Platforma va fi în mentenanță programată."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Salvat.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Se salvează…" : "Salvează"}
      </button>
    </form>
  );
}
