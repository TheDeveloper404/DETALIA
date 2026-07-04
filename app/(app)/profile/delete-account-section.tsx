"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteAccountAction } from "./actions";

// Ștergere cont (GDPR) — ireversibilă. Confirmare în 2 pași + tastarea cuvântului „ȘTERGE" ca să nu fie accidentală.
// La confirmare, server action-ul anonimizează contul (șterge PII, păstrează conținutul) și face logout (redirect).
const CONFIRM_WORD = "ȘTERGE";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={confirm.trim() !== CONFIRM_WORD || pending}
              onClick={() => startTransition(() => deleteAccountAction())}
            >
              {pending ? "Se șterge…" : "Confirm ștergerea definitivă"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
            >
              Anulează
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
