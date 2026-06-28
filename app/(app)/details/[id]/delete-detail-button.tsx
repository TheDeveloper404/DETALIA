"use client";

import { Trash2 } from "lucide-react";

import { deleteDetailAction } from "./delete-actions";

// Butonul de ștergere a unui detaliu — vizibil DOAR autorului (gating în page.tsx).
// Confirmare explicită înainte de submit: ștergerea e ireversibilă (schițe, validări, comentarii cad cu el).
export function DeleteDetailButton({ detailId }: { detailId: string }) {
  return (
    <form
      action={deleteDetailAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Sigur ștergi acest detaliu? Schițele, validările și comentariile lui se șterg definitiv.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="detailId" value={detailId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md border border-[#e6c9c4] bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-[#b0463c] transition-colors hover:bg-[#fbf1ef]"
      >
        <Trash2 className="size-3.5" strokeWidth={2} />
        Șterge
      </button>
    </form>
  );
}
