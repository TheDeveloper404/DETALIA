"use client";

import { Pencil, PenLine } from "lucide-react";
import { createPortal } from "react-dom";
import { startTransition, useActionState, useOptimistic, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { ShowMoreButton } from "@/components/show-more-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoteTriangle } from "@/components/vote-triangle";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_LENGTH } from "@/server/domain/validation";
import type { TargetType, ValidationPosition } from "@/server/domain/validation";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { approveAction, disapproveAction, retractAction, type DisapproveState } from "./validation-actions";

const initialState: DisapproveState = { error: null };

// Pozițiile celorlalți — tăiate la un plafon fix, „Vezi mai multe" pentru rest (2026-08-16, raportat
// Liviu: cu 50 de useri, lista devenea un perete înainte de comentarii). Vezi UI-REGISTRY.md
// §„Vezi mai multe".
const VISIBLE_POSITIONS = 6;

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
  voteSlot = null,
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
  // Nod DOM din bara de taburi (detail-workspace.tsx) unde se portalează controlul compact de vot
  // (2026-08-16, raportat Liviu: coloana verticală de jos „pare orfană"). Starea/logica de vot rămân
  // AICI, într-o singură instanță de componentă — doar JSX-ul butoanelor se randează în alt loc din
  // DOM (React portal), ca să nu dublăm/rupem fluxul de aprob/dezaprob/optimistic UI. Fără el (null),
  // butoanele cad pe randarea locală, verticală, de mai jos — comportament identic cu dinainte.
  voteSlot?: Element | null;
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

  const [positionsExpanded, setPositionsExpanded] = useState(false);
  const visiblePositions = positionsExpanded ? positions : positions.slice(0, VISIBLE_POSITIONS);

  // Câmpurile ascunse comune (țintă + pagina de revalidat).
  const hidden = (
    <>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  // Widget orizontal stil StackOverflow: săgeată stânga (Aprob) / count / săgeată dreapta (Dezaprob).
  // 2026-08-16 (raportat Liviu): mutat din coloană verticală în bara de taburi (portal, `voteSlot`) —
  // „pare orfană" jos, izolată de restul cardului. Poziția activă rămâne umplută + colorată; săgeata
  // opusă e dezactivată cât ai o poziție — comutarea trece explicit prin „Retrage" (click pe săgeata
  // activă), nu direct dintr-o poziție în alta. Aceeași logică/stare ca înainte, doar orientare + loc.
  const voteButtons = (
    <div className="flex items-center gap-1.5">
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
        <VoteTriangle direction="up" size={11} />
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
        <VoteTriangle direction="down" size={11} />
      </button>
    </div>
  );

  return (
    <>
      {canValidate && voteSlot && createPortal(voteButtons, voteSlot)}
      <section
        className={cn(
          "text-card-foreground",
          embedded ? "" : "rounded-xl border border-border bg-card p-5 sm:px-6",
        )}
      >
        {/* Butoanele de validare apar DOAR dacă te poți valida (nu pe propriul conținut). Cu `voteSlot`
            (bara de taburi), butoanele se portalează acolo — aici rămâne doar restul fluxului (alegere/
            justificare). Fără `voteSlot`, cad pe randarea locală (comportament identic cu dinainte). */}
        {canValidate && (
          <>
            {!voteSlot && voteButtons}

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

        {/* Pozițiile celorlalți — nume + rol, transparent (input real, util în dezbatere). Tăiate la
            `VISIBLE_POSITIONS`, „Vezi mai multe" pentru rest — vezi UI-REGISTRY.md. */}
        {positions.length > 0 && (
          <>
            <ul className="mt-4 flex flex-col gap-2.5 border-t border-[#eee6da] pt-4">
              {visiblePositions.map((p) => (
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
            {!positionsExpanded && positions.length > VISIBLE_POSITIONS && (
              <ShowMoreButton onClick={() => setPositionsExpanded(true)} />
            )}
          </>
        )}
      </section>
    </>
  );
}
