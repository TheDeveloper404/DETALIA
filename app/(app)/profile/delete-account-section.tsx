"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteAccountAction } from "./actions";

// Ștergere cont (GDPR) — ireversibilă. Confirmare în 2 pași + tastarea cuvântului „ȘTERGE" ca să nu fie accidentală.
// La confirmare, server action-ul anonimizează contul (șterge PII, păstrează conținutul) și face logout (redirect).
//
// CRITIC: submit prin <form action={...}>, NU onClick+startTransition apelând acțiunea direct (2026-08-08,
// bug real reprodus în CI de 2 ori: signOut() nu golea cookie-ul de sesiune, intermitent). Cauză documentată
// în comunitatea Next.js/next-auth: când un server action e apelat direct (nu ca submit de <form>), ștergerea
// de cookie din signOut() poate să nu se aplice pe răspuns — HTTP nu mai poate seta cookie-uri după ce
// streaming-ul a început, iar apelul direct nu garantează timing-ul corect. Fix documentat: submit real de
// formular, nu apel direct al acțiunii.
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
