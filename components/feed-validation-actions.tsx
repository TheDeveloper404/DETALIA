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

import { computeOptimisticValidationCount } from "./validation-count";
import { VoteTriangle } from "./vote-triangle";

const initialState: DisapproveState = { error: null };

// Validare inline din feed — widget vertical stil StackOverflow (2026-08-07, înlocuiește
// reacția tip „Like"/meniu-pe-hover): săgeată sus (Aprob) / count / săgeată jos (Dezaprob). Aprob = 1
// click; Dezaprob = justificare OBLIGATORIE (devine comentariu pe server, regulă non-negociabilă) — click
// pe săgeata jos deschide modalul, nu trimite direct. Ca înainte: o singură poziție per user, comutare
// doar via „Retrage" (click pe săgeata activă) — săgeata opusă e dezactivată cât ai o poziție, ca să nu
// permită un switch direct fără retragere explicită.
export function FeedValidationActions({
  detailId,
  myPosition,
  validationCount,
}: {
  detailId: string;
  myPosition: ValidationPosition | null;
  validationCount: number;
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
  const displayCount = computeOptimisticValidationCount(validationCount, myPosition, myPos);

  const hidden = (
    <>
      <input type="hidden" name="targetType" value="DETAIL" />
      <input type="hidden" name="targetId" value={detailId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  return (
    <>
    <span className="inline-flex flex-col items-center leading-none">
      <button
        type="button"
        onClick={approved ? onRetract : disapproved ? undefined : onApprove}
        disabled={disapproved}
        aria-label={approved ? "Retrage aprobarea" : "Aprobă"}
        title={approved ? "Ai aprobat — click pentru a retrage" : "Aprob"}
        className={cn(
          "rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30",
          approved ? "text-[#2f6b3f]" : "text-muted-foreground hover:text-[#2f6b3f]",
        )}
      >
        <VoteTriangle direction="up" size={7} />
      </button>
      <span className="sr-only">validări:</span>
      <span className="px-0.5 font-mono text-[11px] font-semibold">{displayCount}</span>
      <button
        type="button"
        onClick={disapproved ? onRetract : approved ? undefined : () => setShowJustify(true)}
        disabled={approved}
        aria-label={disapproved ? "Retrage dezaprobarea" : "Dezaprobă"}
        title={disapproved ? "Ai dezaprobat — click pentru a retrage" : "Dezaprob"}
        className={cn(
          "rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30",
          disapproved ? "text-destructive" : "text-muted-foreground hover:text-destructive",
        )}
      >
        <VoteTriangle direction="down" size={7} />
      </button>
    </span>

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
    </>
  );
}
