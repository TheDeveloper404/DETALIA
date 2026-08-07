"use client";

import { ArrowBigDown, ArrowBigUp, Pencil, PenLine } from "lucide-react";
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
    setMode("none");
    startTransition(async () => {
      applyOpt("RETRACT");
      await retractAction(targetFormData());
    });
  }
  function onPickDisapprove() {
    setMode(allowSketch ? "choose" : "text");
  }


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
          {/* Fără poziție: cele două butoane. Cu poziție: colaps într-o SINGURĂ pastilă colorată cu
              „retrage" integrat (fără banner separat) — mai puțin zgomot + înălțime constantă a zonei. */}
          <div className="flex items-center gap-4">
            {/* Widget vertical stil StackOverflow (2026-08-07, cerere Liviu, înlocuiește perechea de
                butoane cu Check/X): săgeată sus (Aprob) / count total / săgeată jos (Dezaprob). Poziția
                activă rămâne umplută + colorată; săgeata opusă e dezactivată cât ai o poziție — comutarea
                trece explicit prin „Retrage" (click pe săgeata activă), nu direct dintr-o poziție în alta. */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={approved ? onRetract : myPos ? undefined : onApprove}
                disabled={myPos !== null && !approved}
                aria-label={approved ? "Retrage aprobarea" : "Aprobă"}
                title={approved ? "Ai aprobat — click pentru a retrage" : "Aprob"}
                className={cn(
                  "rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                  approved ? "text-emerald-600" : "text-muted-foreground hover:text-emerald-600",
                )}
              >
                <ArrowBigUp className="size-7 shrink-0" strokeWidth={2} fill={approved ? "currentColor" : "none"} />
              </button>
              <span className="font-mono text-sm font-bold text-foreground">{totalValidari}</span>
              <button
                type="button"
                onClick={myPos && !approved ? onRetract : approved ? undefined : onPickDisapprove}
                disabled={approved}
                aria-expanded={mode !== "none"}
                aria-label={myPos && !approved ? "Retrage dezaprobarea" : "Dezaprobă"}
                title={myPos && !approved ? "Ai dezaprobat — click pentru a retrage" : "Dezaprob"}
                className={cn(
                  "rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                  myPos && !approved ? "text-destructive" : "text-muted-foreground hover:text-destructive",
                )}
              >
                <ArrowBigDown
                  className="size-7 shrink-0"
                  strokeWidth={2}
                  fill={myPos && !approved ? "currentColor" : "none"}
                />
              </button>
            </div>

            <span className="font-mono text-[11px] leading-tight text-[#a59a88]">
              o singură poziție
              <br /> reversibilă oricând
            </span>
          </div>

          {/* Pas de ALEGERE (doar pe detaliu): una din două — argumentezi în text SAU desenezi o schiță. */}
          {!myPos && mode === "choose" && (
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
          {!myPos && mode === "text" && (
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
            <li key={p.userId} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
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
