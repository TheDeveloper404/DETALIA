"use client";
export function PrintButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      Salvează PDF
    </button>
  );
}
