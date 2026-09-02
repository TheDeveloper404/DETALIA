"use client";

import { useActionState } from "react";

import {
  confirmEnrollmentAction,
  finishAdminTotpEnrollmentAction,
  verifySecondFactorAction,
} from "./actions";
import { INITIAL_TOTP_STATE } from "./state";

// Un singur formular pentru ambele ecrane — diferă doar acțiunea de server și ce se acceptă în câmp.
// `mode` e o primitivă, nu o funcție: props dinspre Server Component nu pot fi funcții (vezi capcana
// RSC din CLAUDE.md), deci acțiunea se alege AICI, în client.
export function AdminTotpForm({ mode }: { mode: "enroll" | "verify" }) {
  const [state, formAction, pending] = useActionState(
    mode === "enroll" ? confirmEnrollmentAction : verifySecondFactorAction,
    INITIAL_TOTP_STATE,
  );

  // Înrolare reușită → codurile de rezervă, afișate O SINGURĂ dată (în DB rămân doar hash-urile).
  if (state.backupCodes) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">Coduri de rezervă</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Notează-le acum și ține-le undeva sigur, în afara telefonului. Nu mai pot fi afișate a
            doua oară. Fiecare funcționează o singură dată, în locul codului din aplicație.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm">
            {state.backupCodes.map((code) => (
              <li key={code} className="rounded bg-muted px-2 py-1 text-center tracking-wider">
                {code}
              </li>
            ))}
          </ul>
        </div>
        <form action={finishAdminTotpEnrollmentAction}>
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Le-am notat, intră în panou
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm font-medium">
        {mode === "enroll" ? "Cod din aplicație" : "Cod de verificare"}
      </label>
      <input
        id="code"
        name="code"
        // `one-time-code` lasă iOS/Android să propună codul direct din tastatură.
        autoComplete="one-time-code"
        // Nu fixăm `inputMode="numeric"`: la verificare, câmpul acceptă și un cod de rezervă
        // alfanumeric, iar o tastatură doar-cifre ar face imposibilă tastarea lui pe telefon.
        inputMode={mode === "enroll" ? "numeric" : "text"}
        autoFocus
        spellCheck={false}
        placeholder={mode === "enroll" ? "123456" : "123456 sau cod de rezervă"}
        className="rounded-lg border border-border bg-card px-3 py-2 text-center font-mono text-lg tracking-widest"
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Se verifică…" : mode === "enroll" ? "Activează" : "Confirmă"}
      </button>
    </form>
  );
}
