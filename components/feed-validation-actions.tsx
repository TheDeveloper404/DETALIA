"use client";

import { Check, ThumbsUp, X } from "lucide-react";
import { startTransition, useActionState, useOptimistic, useRef, useState } from "react";

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

// Validare inline din feed — UN SINGUR buton (2026-07-06, redesign cerut de Liviu, pattern „reacții
// LinkedIn"): hover peste iconiță → mini-meniu cu Aprob/Dezaprob. Aprob = 1 click; Dezaprob = justificare
// OBLIGATORIE (devine comentariu pe server, regulă non-negociabilă). După poziționare, butonul colapsează
// la iconița stării (colorată) + „Retrage" apare la hover — același principiu icon-hover-text ca la
// „Schițează peste"/„Trimite în Planșă" de sub el și ca „Schițează peste detaliu" din workspace.
export function FeedValidationActions({
  detailId,
  myPosition,
}: {
  detailId: string;
  myPosition: ValidationPosition | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showJustify, setShowJustify] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setMenuOpen(false);
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

  // Mic delay la închidere (mouse leave) ca mutarea cursorului spre meniu (dedesubt) să nu-l închidă
  // instant — pattern standard pentru popover-e „reacții" pe hover.
  function openMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setMenuOpen(false), 150);
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
    <div className="mt-auto flex items-center">
      {!myPos ? (
        <div className="relative inline-flex" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Validează"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ThumbsUp className="size-4" strokeWidth={2} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-20 mb-1.5 flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card p-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] font-semibold text-[#2f6b3f] transition-colors hover:bg-[#e9f2ea]"
              >
                <Check className="size-3.5" strokeWidth={2.4} />
                Aprob
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowJustify(true);
                  setMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                <X className="size-3.5" strokeWidth={2.4} />
                Dezaprob
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onRetract}
          title={approved ? "Ai aprobat — click pentru a retrage" : "Ai dezaprobat — click pentru a retrage"}
          className={cn(
            "group/valid inline-flex items-center overflow-hidden rounded-full px-1.5 py-1 font-mono text-[11.5px] font-semibold transition-colors",
            approved ? "text-[#2f6b3f] hover:bg-[#e9f2ea]" : "text-destructive hover:bg-destructive/10",
          )}
        >
          {approved ? (
            <ThumbsUp className="size-4 shrink-0 fill-current" strokeWidth={2} />
          ) : (
            <X className="size-4 shrink-0" strokeWidth={2.6} />
          )}
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/valid:ml-1.5 group-hover/valid:max-w-[80px] group-hover/valid:opacity-100">
            Retrage
          </span>
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
