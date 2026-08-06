// Shortcut-uri de tastatură pentru suprafețele de desen (schiță / planșă).
//
// Funcție PURĂ, separată de componentă, ca să fie testabilă fără DOM: primește forma minimă a unui
// eveniment de tastatură + dacă userul editează text, și decide ce acțiune de istoric se declanșează.
//
// Regula critică: cât timp userul tastează într-un `<textarea>`/`<input>` (tool-ul de text), Ctrl+Z
// trebuie să rămână undo-ul NATIV al casetei (șterge ce a tastat), NU undo-ul desenului — altfel
// desenul se anulează sub degete în timp ce scrii.
export type CanvasShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type CanvasHistoryAction = "undo" | "redo";

export function resolveCanvasShortcut(
  event: CanvasShortcutEvent,
  opts: { isEditingText: boolean },
): CanvasHistoryAction | null {
  if (opts.isEditingText) return null;

  // Ctrl (Windows/Linux) sau Cmd (macOS) — niciodată ambele-obligatorii.
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return null;

  const key = event.key.toLowerCase();

  // Ctrl+Y = redo (convenția Windows), fără Shift.
  if (key === "y" && !event.shiftKey) return "redo";
  if (key !== "z") return null;

  // Ctrl+Shift+Z = redo (convenția macOS/Adobe), Ctrl+Z = undo.
  return event.shiftKey ? "redo" : "undo";
}
