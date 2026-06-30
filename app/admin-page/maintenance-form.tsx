"use client";

import { useActionState } from "react";

import { type MaintenanceFormState, setPlatformAction } from "./actions";

const INITIAL: MaintenanceFormState = { ok: false, error: null };

type Defaults = {
  announcement: { enabled: boolean; date: string | null; message: string | null };
  lockdown: { enabled: boolean; message: string | null };
};

// Formularul de mentenanță (client). DOUĂ controale independente: anunț programat + lockdown total.
// Validarea reală e pe server.
export function MaintenanceForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState(setPlatformAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {/* ─── (1) Anunț programat ─── */}
      <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Anunț programat</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="announcementEnabled"
            defaultChecked={defaults.announcement.enabled}
            className="mt-0.5 size-4 accent-foreground"
          />
          <span>
            <span className="block text-sm font-semibold">Afișează banner în feed</span>
            <span className="block text-[13px] text-muted-foreground">
              Platforma funcționează normal; userii logați văd un banner cu data anunțată (avertizare în avans).
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="announcementDate" className="text-sm font-medium">
            Data anunțată <span className="text-muted-foreground">(opțional)</span>
          </label>
          <input
            id="announcementDate"
            type="date"
            name="announcementDate"
            defaultValue={defaults.announcement.date ?? ""}
            className="w-fit rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="announcementMessage" className="text-sm font-medium">
            Mesaj banner <span className="text-muted-foreground">(opțional)</span>
          </label>
          <textarea
            id="announcementMessage"
            name="announcementMessage"
            maxLength={280}
            rows={2}
            defaultValue={defaults.announcement.message ?? ""}
            placeholder="ex. Pe 05.10.2026 platforma va fi în mentenanță programată."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {/* ─── (2) Lockdown total ─── */}
      <fieldset className="flex flex-col gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <legend className="px-1 text-sm font-semibold text-destructive">Lockdown total</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="lockdownEnabled"
            defaultChecked={defaults.lockdown.enabled}
            className="mt-0.5 size-4 accent-destructive"
          />
          <span>
            <span className="block text-sm font-semibold">Închide platforma pentru toți</span>
            <span className="block text-[13px] text-muted-foreground">
              Toți (anonimi și logați) văd „site în lucru&rdquo;. DOAR adminul mai intră, pe /admin-page.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lockdownMessage" className="text-sm font-medium">
            Mesaj pe ecranul „site în lucru&rdquo; <span className="text-muted-foreground">(opțional)</span>
          </label>
          <textarea
            id="lockdownMessage"
            name="lockdownMessage"
            maxLength={280}
            rows={2}
            defaultValue={defaults.lockdown.message ?? ""}
            placeholder="ex. Revenim în câteva ore."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

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
