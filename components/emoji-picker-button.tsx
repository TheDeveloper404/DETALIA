"use client";

// Buton de emoji — nu depinde de tastatura de sistem (Win+. / Cmd+Ctrl+Space). Set curat, fără librărie
// externă (evită o dependență grea doar pentru asta); suficient pt dezbatere pe roluri, nu chat general.
import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EMOJI = [
  "👍", "👎", "🙏", "👏", "💪", "🤝", "✅", "❌",
  "⚠️", "❗", "❓", "💡", "🔥", "💯", "🎉", "👀",
  "😀", "😂", "🙂", "😉", "😅", "🤔", "😍", "😢",
  "😮", "😡", "🏗️", "🧱", "📐", "🔧", "🔩", "🛠️",
  "📏", "🏠", "🧊", "❤️",
];

export function EmojiPickerButton({
  onPick,
  disabled,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Adaugă emoji"
        title="Emoji"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Smile className="size-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1.5 grid w-max grid-cols-9 gap-0.5 rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="flex size-7 items-center justify-center rounded text-[17px] leading-none transition-colors hover:bg-secondary"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
