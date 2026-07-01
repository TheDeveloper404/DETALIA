"use client";

import { startTransition, useActionState, useOptimistic, useState } from "react";

import {
  approveAction,
  disapproveAction,
  retractAction,
  type DisapproveState,
} from "@/app/(app)/details/[id]/validation-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_LENGTH } from "@/server/domain/validation";
import type { ValidationPosition } from "@/server/domain/validation";

const initialState: DisapproveState = { error: null };

// Validare inline din feed — buton IDENTIC pentru toți. Aprob = 1 click; Dezaprob = justificare
// OBLIGATORIE (devine comentariu pe server, regulă non-negociabilă). Poziție unică, reversibilă.
// Justificarea se dă într-un MODAL (overlay), ca să nu mărească/împingă cardul din feed.
export function FeedValidationActions({
  detailId,
  myPosition,
}: {
  detailId: string;
  myPosition: ValidationPosition | null;
}) {
  const [showJustify, setShowJustify] = useState(false);
  const [state, formAction, pending] = useActionState(disapproveAction, initialState);

  // Optimistic UI: Aprob/Retrage reacționează INSTANT, apoi se reconciliază cu serverul (props revin după
  // revalidatePath). Dezaprobarea rămâne pe form (justificare validată server) — devine DISAPPROVE la revalidare.
  const [myPos, applyOpt] = useOptimistic<ValidationPosition | null, "APPROVE" | "RETRACT">(
    myPosition,
    (_s, action) => (action === "APPROVE" ? "APPROVE" : null),
  );
  const approved = myPos === "APPROVE";
  const disapproved = myPos === "DISAPPROVE";

  function targetFormData(): FormData {
    const fd = new FormData();
    fd.set("targetType", "DETAIL");
    fd.set("targetId", detailId);
    fd.set("detailId", detailId);
    return fd;
  }
  function onApprove() {
    startTransition(async () => {
      applyOpt("APPROVE");
      await approveAction(targetFormData());
    });
  }
  function onRetract() {
    startTransition(async () => {
      applyOpt("RETRACT");
      await retractAction(targetFormData());
    });
  }

  // Modalul e deschis doar cât NU ești dezaprobat: după o dezaprobare reușită (revalidare →
  // myPosition devine DISAPPROVE) se închide automat, fără effect/setState.
  const justifyOpen = showJustify && !disapproved;

  const hidden = (
    <>
      <input type="hidden" name="targetType" value="DETAIL" />
      <input type="hidden" name="targetId" value={detailId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  return (
    <div className="mt-auto flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onApprove}
        aria-pressed={approved}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
          approved
            ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
            : "border-[#cfe3d2] bg-[#e9f2ea] text-[#2f6b3f] hover:bg-[#dbe9dd]",
        )}
      >
        ✓ {approved ? "Ai aprobat" : "Aprob"}
      </button>

      <button
        type="button"
        onClick={() => setShowJustify(true)}
        aria-pressed={disapproved}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
          disapproved
            ? "border-destructive bg-destructive text-white shadow-sm"
            : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        )}
      >
        ✕ {disapproved ? "Ai dezaprobat" : "Dezaprob"}
      </button>

      {myPos && (
        <button
          type="button"
          onClick={onRetract}
          className="font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          retrage poziția
        </button>
      )}

      {/* Modal de justificare — overlay fix, nu împinge layout-ul cardului. */}
      {justifyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowJustify(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-heading text-base font-bold">Dezaprobi acest detaliu</h3>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Dezaprobarea cere o justificare — apare ca poziție argumentată în dezbatere, lângă numele și
              rolul tău. Nu există „dezaprobare mută”.
            </p>
            <form action={formAction} className="flex flex-col gap-2">
              {hidden}
              <Textarea
                name="justification"
                required
                autoFocus
                rows={4}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder="Explică de ce dezaprobi…"
              />
              {state.error && (
                <p role="alert" className="text-xs text-destructive">
                  {state.error}
                </p>
              )}
              <div className="mt-1 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowJustify(false)}
                >
                  Renunță
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="send"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                >
                  {pending ? "Se trimite…" : "Trimite dezaprobarea"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
