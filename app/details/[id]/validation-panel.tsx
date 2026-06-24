"use client";

import { useActionState, useState } from "react";

import { AuthorBadge } from "@/components/author-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  allowSketch: boolean; // butonul „Dezaprob și fac o schiță" — doar pe DETAIL
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
}) {
  const [showJustify, setShowJustify] = useState(false);
  const [state, formAction, pending] = useActionState(disapproveAction, initialState);

  // Câmpurile ascunse comune (țintă + pagina de revalidat).
  const hidden = (
    <>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="detailId" value={detailId} />
    </>
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Validare pe roluri</h2>
        <p className="text-xs text-muted-foreground">
          Aprobat de <strong className="text-foreground">{counts.approve}</strong> · Dezaprobat de{" "}
          <strong className="text-foreground">{counts.disapprove}</strong>
        </p>
      </div>

      <div className="flex gap-2">
        <form action={approveAction} className="flex flex-1">
          {hidden}
          <Button
            type="submit"
            variant={myPosition === "APPROVE" ? "default" : "outline"}
            className="h-9 w-full"
          >
            Aprob
          </Button>
        </form>
        <Button
          type="button"
          onClick={() => setShowJustify((v) => !v)}
          variant={myPosition === "DISAPPROVE" ? "destructive" : "outline"}
          aria-expanded={showJustify}
          className="h-9 flex-1"
        >
          Dezaprob
        </Button>
      </div>

      {showJustify && (
        <form action={formAction} className="flex flex-col gap-2">
          {hidden}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Justificare (obligatorie)</span>
            <Textarea
              name="justification"
              required
              rows={3}
              placeholder="Explică de ce dezaprobi…"
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

      {myPosition && (
        <form action={retractAction}>
          {hidden}
          <button
            type="submit"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Retrage poziția
          </button>
        </form>
      )}

      {positions.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {positions.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-2">
              <AuthorBadge
                name={p.userName}
                roleMain={p.roleMain}
                subRole={p.subRole}
                verified={p.verification === "VERIFIED"}
              />
              <span
                className={
                  p.position === "APPROVE"
                    ? "shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    : "shrink-0 text-xs font-medium text-destructive"
                }
              >
                {p.position === "APPROVE" ? "Aprobă" : "Dezaprobă"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
