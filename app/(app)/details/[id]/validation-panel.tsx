"use client";

import { Check, Pencil, PenLine, X } from "lucide-react";
import { startTransition, useActionState, useOptimistic, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_LENGTH } from "@/server/domain/validation";
import type { TargetType, ValidationPosition } from "@/server/domain/validation";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { approveAction, disapproveAction, retractAction, type DisapproveState } from "./validation-actions";

const initialState: DisapproveState = { error: null };

export function ValidationPanel({
  targetType,
  targetId,
  detailId,
  allowSketch,
  canValidate = true,
  counts,
  myPosition,
  positions,
  meta,
  embedded = false,
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  allowSketch: boolean; // ramura „Fă o schiță" la dezaprobare — doar pe DETAIL
  canValidate?: boolean; // false = nu te poți valida pe propriul conținut → ascundem butoanele
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
  meta?: { comments: number; sketches: number }; // contoare detaliu (validări/comentarii/schițe) — doar pe DETAIL
  embedded?: boolean; // true = fără card propriu (border/bg/padding) + butoane compacte, integrat în workspace
}) {
  // Fluxul de dezaprobare: "none" (ascuns) → "choose" (alegere binară text/schiță) → "text" (justificare).
  // Pe ținte fără ramura schiță (SKETCH) sărim direct la "text" — o singură cale, fără alegere inutilă.
  const [mode, setMode] = useState<"none" | "choose" | "text">("none");
  const [state, formAction, pending] = useActionState(disapproveAction, initialState);

  // Optimistic UI: click-ul de Aprob/Retract se reflectă INSTANT în UI, apoi se reconciliază cu serverul
  // (când props-urile revin actualizate după revalidatePath). Elimină senzația de „buton blocat".
  type Opt = { pos: ValidationPosition | null; approve: number; disapprove: number };
  const [opt, applyOpt] = useOptimistic<Opt, "APPROVE" | "DISAPPROVE" | "RETRACT">(
    { pos: myPosition, approve: counts.approve, disapprove: counts.disapprove },
    (s, action) => {
      // Scoate poziția curentă din contoare, apoi aplică noua acțiune (o singură poziție per user).
      const approve = s.approve - (s.pos === "APPROVE" ? 1 : 0);
      const disapprove = s.disapprove - (s.pos === "DISAPPROVE" ? 1 : 0);
      if (action === "APPROVE") return { pos: "APPROVE", approve: approve + 1, disapprove };
      if (action === "DISAPPROVE") return { pos: "DISAPPROVE", approve, disapprove: disapprove + 1 };
      return { pos: null, approve, disapprove };
    },
  );

  const myPos = opt.pos;
  const approved = myPos === "APPROVE";
  const disapproved = myPos === "DISAPPROVE";
  const totalValidari = opt.approve + opt.disapprove;

  // FormData comun pentru acțiunile 1-click (aceleași câmpuri ca `hidden`, dar apelate programatic).
  function targetFormData(): FormData {
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    fd.set("detailId", detailId);
    return fd;
  }
  function onApprove() {
    setMode("none");
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
  // Polimorfic: aceeași validare pe detaliu SAU pe schiță — textul confirmării urmează ținta.
  const targetNoun = targetType === "SKETCH" ? "această schiță" : "acest detaliu";

  // În workspace (embedded) butoanele sunt mai compacte (fără container propriu, cerință Edi);
  // standalone rămân la dimensiunea mare de dinainte.
  const validateBtnClass = embedded ? "px-4 py-2.5 text-sm" : "px-5 py-3 text-[15px]";

  // Câmpurile ascunse comune (țintă + pagina de revalidat).
  const hidden = (
    <>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  return (
    <section
      className={cn(
        "text-card-foreground",
        embedded ? "" : "rounded-xl border border-border bg-card p-5 sm:px-6",
      )}
    >
      {/* Butoanele de validare apar DOAR dacă te poți valida (nu pe propriul conținut). */}
      {canValidate && (
        <>
          {/* Butoane — identice pentru toți; greutatea o dă rolul, nu un scor. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onApprove}
              aria-pressed={approved}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-[10px] border font-bold transition-colors",
                validateBtnClass,
                approved
                  ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary",
              )}
            >
              <Check className="size-[17px]" strokeWidth={2.6} />
              Aprob
            </button>

            <button
              type="button"
              onClick={() => setMode((m) => (m === "none" ? (allowSketch ? "choose" : "text") : "none"))}
              aria-expanded={mode !== "none"}
              aria-pressed={disapproved}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-[10px] border font-bold transition-colors",
                validateBtnClass,
                disapproved
                  ? "border-destructive bg-destructive text-white shadow-sm"
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

          {/* Pas de ALEGERE (doar pe detaliu): una din două — argumentezi în text SAU desenezi o schiță. */}
          {mode === "choose" && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm font-medium">Cum vrei să dezaprobi?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-card p-3.5 text-left transition-colors hover:border-primary"
                >
                  <PenLine className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.9} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">Scrie o justificare</span>
                    <span className="text-xs text-muted-foreground">Argumentezi în text — apare în dezbatere.</span>
                  </span>
                </button>
                <form action={formAction} className="contents">
                  {hidden}
                  <button
                    type="submit"
                    name="intent"
                    value="sketch"
                    disabled={pending}
                    className="flex items-start gap-3 rounded-[10px] border border-border bg-card p-3.5 text-left transition-colors hover:border-primary disabled:opacity-60"
                  >
                    <Pencil className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.9} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">Fă o schiță</span>
                      <span className="text-xs text-muted-foreground">Desenezi peste detaliu — schița e justificarea.</span>
                    </span>
                  </button>
                </form>
              </div>
              {state.error && (
                <p role="alert" className="text-xs text-destructive">
                  {state.error}
                </p>
              )}
            </div>
          )}

          {/* Ramura TEXT: justificare OBLIGATORIE (devine comentariu pe server). Fără „dezaprobare mută". */}
          {mode === "text" && (
            <form action={formAction} className="mt-4 flex flex-col gap-2">
              {hidden}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Justificare (obligatorie)</span>
                <Textarea
                  name="justification"
                  required
                  rows={3}
                  maxLength={COMMENT_MAX_LENGTH}
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
                  <Button type="button" variant="ghost" onClick={() => setMode("choose")} disabled={pending}>
                    ← Înapoi
                  </Button>
                )}
              </div>
            </form>
          )}

          {/* Confirmarea poziției proprii + retragere (reversibilă oricând). */}
          {myPos && (
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
              <button
                type="button"
                onClick={onRetract}
                className="ml-auto font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                retrage poziția
              </button>
            </div>
          )}
        </>
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
                <RolePill roleMain={p.roleMain} subRole={p.subRole} verified={p.verification === "VERIFIED"} />
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
