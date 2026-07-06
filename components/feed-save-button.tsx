"use client";

// Bookmark „Salvează" pe cardul din feed — colț dreapta-sus al containerului de conținut, NU peste
// imagine (task Edi, 2026-07-06).
// La click devine galben (salvat) — optimist, apoi reconciliat cu serverul (pattern identic cu
// FeedValidationActions: startTransition + useOptimistic, fără să aștepți round-trip-ul).
import { Bookmark } from "lucide-react";
import { startTransition, useOptimistic } from "react";

import { toggleSaveDetailForFeedAction } from "@/app/(app)/details/[id]/save-actions";
import { cn } from "@/lib/utils";

export function FeedSaveButton({ detailId, isSaved }: { detailId: string; isSaved: boolean }) {
  const [saved, setSaved] = useOptimistic(isSaved, (_s, next: boolean) => next);

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); // cardul întreg e link — nu naviga la click pe bookmark
    e.stopPropagation();
    const next = !saved;
    startTransition(async () => {
      setSaved(next);
      await toggleSaveDetailForFeedAction(detailId);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      title={saved ? "Salvat — scoate din salvate" : "Salvează detaliul"}
      className="absolute right-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-md border border-border bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
    >
      <Bookmark
        className={cn("size-4", saved && "fill-[#d99a2b] text-[#d99a2b]")}
        strokeWidth={2}
      />
    </button>
  );
}
