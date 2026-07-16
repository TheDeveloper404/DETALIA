"use client";

import { useEffect } from "react";

// Confirmare de acțiune ireversibilă — stil platformă, NU popup-ul nativ al browserului (window.confirm).
// 2026-07-16, cerere Edi: „Șterge schița"/„Șterge detaliul" arătau confirmarea browser-ului, inconsecvent
// vizual cu restul platformei.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Șterge",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-destructive bg-destructive px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
