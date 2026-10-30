"use client";

import { Pencil, PenLine, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { startTransition, useActionState, useOptimistic, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { DialogOverlay } from "@/components/dialog-overlay";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoteTriangle } from "@/components/vote-triangle";
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
  // (2026-08-16, raportat: coloana verticală de jos „pare orfană"). Starea/logica de vot rămân
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

  const [positionsTab, setPositionsTab] = useState<ValidationPosition | null>(null);
  const visiblePositions = positions.filter((p) => p.position === positionsTab);

  // Câmpurile ascunse comune (țintă + pagina de revalidat).
  const hidden = (
    <>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  const positionsButton = (
    <button
      type="button"
      onClick={() => setPositionsTab("APPROVE")}
      aria-label="Vezi validările"
      aria-haspopup="dialog"
      aria-expanded={positionsTab !== null}
      title="Vezi validările"
      className="min-h-11 min-w-6 font-mono text-sm font-bold text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
    >
      {totalValidari}
    </button>
  );

  // Widget orizontal stil StackOverflow: săgeată stânga (Aprob) / count / săgeată dreapta (Dezaprob).
  // 2026-08-16 (raportat): mutat din coloană verticală în bara de taburi (portal, `voteSlot`) —
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
      {positionsButton}
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
      {(!embedded || (canValidate && (!voteSlot || mode !== "none")) || meta || (!canValidate && positions.length > 0)) && (
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

        {!canValidate && positions.length > 0 && positionsButton}
      </section>
      )}
      {positionsTab !== null && createPortal(
        <DialogOverlay
          onClose={() => setPositionsTab(null)}
          ariaLabel="Validări"
          backdropClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          panelClassName="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h2 className="text-sm font-semibold">Validări</h2>
            <button type="button" onClick={() => setPositionsTab(null)} aria-label="Închide validările" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div role="group" aria-label="Tip validare" className="flex gap-2 border-b border-border px-4 py-2">
            {(["APPROVE", "DISAPPROVE"] as const).map((position) => (
              <button key={position} type="button" aria-pressed={positionsTab === position} onClick={() => setPositionsTab(position)} className={cn("min-h-11 rounded-lg px-3 text-sm font-semibold", positionsTab === position ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary")}>
                {position === "APPROVE" ? `Aprobări (${opt.approve})` : `Dezaprobări (${opt.disapprove})`}
              </button>
            ))}
          </div>
          {visiblePositions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{positionsTab === "APPROVE" ? "Nicio aprobare încă." : "Nicio dezaprobare încă."}</p>
          ) : (
            <ul data-testid="validation-positions-list" className="max-h-[60dvh] space-y-2.5 overflow-y-auto p-4">
              {visiblePositions.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <Link href={`/profile/${p.userId}`} onClick={() => setPositionsTab(null)} className="flex min-w-0 items-center gap-2 no-underline">
                      <AvatarInitials name={p.userName} imageUrl={p.userImage} size={28} />
                      <span className="truncate text-sm font-semibold hover:underline">{p.userName ?? "Anonim"}</span>
                    </Link>
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
        </DialogOverlay>,
        document.body,
      )}
    </>
  );
}
