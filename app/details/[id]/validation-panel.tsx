"use client";

import { useActionState, useState } from "react";

import { AuthorBadge } from "@/components/author-badge";
import type { TargetType, ValidationPosition } from "@/server/domain/validation";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { approveAction, disapproveAction, retractAction, type DisapproveState } from "./validation-actions";

const initialState: DisapproveState = { error: null };

const activeBtn = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
const idleBtn =
  "border-zinc-300 text-zinc-800 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-200";
const btnBase = "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors";

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
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Validare pe roluri</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Aprobat de <strong>{counts.approve}</strong> · Dezaprobat de{" "}
          <strong>{counts.disapprove}</strong>
        </p>
      </div>

      <div className="flex gap-2">
        <form action={approveAction} className="flex flex-1">
          {hidden}
          <button type="submit" className={`${btnBase} ${myPosition === "APPROVE" ? activeBtn : idleBtn}`}>
            Aprob
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowJustify((v) => !v)}
          className={`${btnBase} ${myPosition === "DISAPPROVE" ? activeBtn : idleBtn}`}
        >
          Dezaprob
        </button>
      </div>

      {showJustify && (
        <form action={formAction} className="flex flex-col gap-2">
          {hidden}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Justificare (obligatorie)
            </span>
            <textarea
              name="justification"
              required
              rows={3}
              placeholder="Explică de ce dezaprobi…"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="intent"
              value="send"
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Se trimite…" : "Trimite dezaprobarea"}
            </button>
            {allowSketch && (
              <button
                type="submit"
                name="intent"
                value="sketch"
                disabled={pending}
                className="rounded-md border border-red-600 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Dezaprob și fac o schiță
              </button>
            )}
          </div>
        </form>
      )}

      {myPosition && (
        <form action={retractAction}>
          {hidden}
          <button
            type="submit"
            className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Retrage poziția
          </button>
        </form>
      )}

      {positions.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
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
                    : "shrink-0 text-xs font-medium text-red-600 dark:text-red-400"
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
