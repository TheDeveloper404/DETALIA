"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteAccountAction } from "./actions";

// Ștergere cont (GDPR) — ireversibilă. Confirmare în 2 pași + tastarea cuvântului „ȘTERGE" ca să nu fie accidentală.
// La confirmare, server action-ul anonimizează contul (șterge PII, păstrează conținutul) și face logout (redirect).
//
// Submit prin <form action={...}>, NU onClick+startTransition apelând acțiunea direct — rămâne o practică
// bună (server action-urile cu redirect() se comportă mai predictibil ca submit real de formular).
// Ștergerea cookie-ului se face SERVER-SIDE, în deleteAccountAction (vezi actions.ts, SEC-001) — nu mai
// depinde de JS client. `/logout` (app/logout/page.tsx) rămâne ca pas secundar, nu ca singura garanție.
const CONFIRM_WORD = "ȘTERGE";

function ConfirmSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Se șterge…" : "Confirm ștergerea definitivă"}
    </Button>
  );
}

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">Șterge contul</h2>
      <p className="text-xs text-muted-foreground">
        Ștergerea e <strong>definitivă</strong>. Îți ștergem datele personale (email, nume, poze, website,
        dovezile de rol). Detaliile, schițele, comentariile și validările tale rămân în comunitate, atribuite
        „[cont șters]”, ca să nu stricăm dezbaterile altora.
      </p>

      {!open ? (
        <div>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Șterge contul
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground" htmlFor="confirm-delete">
            Scrie <strong>{CONFIRM_WORD}</strong> ca să confirmi:
          </label>
          <Input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="max-w-[220px]"
          />
          <form action={deleteAccountAction} className="flex flex-wrap gap-2">
            <ConfirmSubmitButton disabled={confirm.trim() !== CONFIRM_WORD} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
            >
              Anulează
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
