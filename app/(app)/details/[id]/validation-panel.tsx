"use client";

import { Check, X } from "lucide-react";
import { useActionState, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TargetType, ValidationPosition } from "@/server/domain/validation";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { approveAction, disapproveAction, retractAction, type DisapproveState } from "./validation-actions";

const initialState: DisapproveState = { error: null };

export function ValidationPanel({
  targetType,
  targetId,
  detailId,
  allowSketch,
  counts,
  myPosition,
  positions,
  meta,
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  allowSketch: boolean; // butonul „Dezaprob și fac o schiță" — doar pe DETAIL
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
  meta?: { comments: number; sketches: number }; // contoare detaliu (validări/comentarii/schițe) — doar pe DETAIL
}) {
  const [showJustify, setShowJustify] = useState(false);
  const [state, formAction, pending] = useActionState(disapproveAction, initialState);

  const approved = myPosition === "APPROVE";
  const disapproved = myPosition === "DISAPPROVE";
  const totalValidari = counts.approve + counts.disapprove;
  // Polimorfic: aceeași validare pe detaliu SAU pe schiță — textul confirmării urmează ținta.
  const targetNoun = targetType === "SKETCH" ? "această schiță" : "acest detaliu";

  // Câmpurile ascunse comune (țintă + pagina de revalidat).
  const hidden = (
    <>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5 text-card-foreground sm:px-6">
      {/* Butoane — identice pentru toți; greutatea o dă rolul, nu un scor. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={approveAction} className="contents">
          {hidden}
          <button
            type="submit"
            aria-pressed={approved}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-[10px] border px-5 py-3 text-[15px] font-bold transition-colors",
              approved
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-foreground hover:border-primary",
            )}
          >
            <Check className="size-[17px]" strokeWidth={2.6} />
            Aprob
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowJustify((v) => !v)}
          aria-expanded={showJustify}
          aria-pressed={disapproved}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[10px] border px-5 py-3 text-[15px] font-bold transition-colors",
            disapproved
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-card text-foreground hover:border-primary",
          )}
        >
          <X className="size-4" strokeWidth={2.6} />
          Dezaprob
        </button>

        <span className="font-mono text-[11px] leading-tight text-[#a59a88] sm:ml-auto sm:text-right">
          o singură poziție
          <br className="hidden sm:inline" /> reversibilă oricând
        </span>
      </div>

      {/* Dezaprob = justificare OBLIGATORIE (devine comentariu pe server). Fără „dezaprobare mută". */}
      {showJustify && (
        <form action={formAction} className="mt-4 flex flex-col gap-2">
          {hidden}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Justificare (obligatorie)</span>
            <Textarea
              name="justification"
              required
              rows={3}
              placeholder="Explică de ce dezaprobi — apare ca poziție argumentată în dezbatere…"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="intent" value="send" variant="destructive" disabled={pending}>
              {pending ? "Se trimite…" : "Trimite dezaprobarea"}
            </Button>
            {allowSketch && (
              <Button type="submit" name="intent" value="sketch" variant="outline" disabled={pending}>
                Dezaprob și fac o schiță
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Confirmarea poziției proprii + retragere (reversibilă oricând). */}
      {myPosition && (
        <div
          className={cn(
            "mt-4 flex items-center gap-3 rounded-[9px] border px-3.5 py-2.5 text-sm",
            approved
              ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          <span className="leading-snug">
            {approved ? `Ai aprobat ${targetNoun}.` : `Ai dezaprobat ${targetNoun}.`}
          </span>
          <form action={retractAction} className="ml-auto">
            {hidden}
            <button
              type="submit"
              className="font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              retrage poziția
            </button>
          </form>
        </div>
      )}

      {/* Contoare detaliu — fără scor, doar rolul la vedere. */}
      {meta && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#eee6da] pt-4 font-mono text-[12.5px] text-muted-foreground">
          <span>
            <b className="font-medium text-foreground">{totalValidari}</b> validări
          </span>
          <span className="text-[#d6cdbd]">·</span>
          <span>
            <b className="font-medium text-foreground">{meta.comments}</b> comentarii
          </span>
          <span className="text-[#d6cdbd]">·</span>
          <span>
            <b className="font-medium text-foreground">{meta.sketches}</b> schițe în teanc
          </span>
          <span className="ml-auto text-[#a59a88]">fără scor — doar rolul, la vedere</span>
        </div>
      )}

      {/* Pozițiile celorlalți — nume + rol, transparent (input real, util în dezbatere). */}
      {positions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2.5 border-t border-[#eee6da] pt-4">
          {positions.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <AvatarInitials name={p.userName} imageUrl={p.userImage} size={28} />
                <span className="truncate text-sm font-semibold">{p.userName ?? "Anonim"}</span>
                <RolePill roleMain={p.roleMain} verified={p.verification === "VERIFIED"} />
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-[11px] font-medium",
                  p.position === "APPROVE" ? "text-emerald-600" : "text-destructive",
                )}
              >
                {p.position === "APPROVE" ? "aprobă" : "dezaprobă"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
