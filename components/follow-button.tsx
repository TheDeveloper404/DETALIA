"use client";
import { Check, Plus, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { setFollowAction } from "@/app/(app)/following/actions";

export function FollowButton({
  kind,
  targetId,
  followed,
}: {
  kind: "USER" | "CATEGORY";
  targetId: string;
  followed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={followed}
        disabled={pending}
        className={`group inline-flex items-center gap-1.5 self-start border px-4 font-semibold transition-colors disabled:opacity-50 ${kind === "USER" ? "h-11 rounded-lg text-sm" : "h-10 rounded-full text-[13.5px]"} ${
          followed
            ? "border-border bg-card text-foreground/80 hover:border-destructive/40 hover:bg-[#fbeeec] hover:text-destructive"
            : kind === "USER"
              ? "border-[var(--primary-button-border)] bg-primary text-primary-foreground hover:bg-[var(--primary-button-border)]"
              : "border-[#ecd3c4] bg-[#fbf1ea] text-[#8a4428] hover:border-primary/50 hover:bg-[#f7e6da]"
        }`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await setFollowAction(kind, targetId, !followed);
              if (!result.ok) setError(result.error);
            } catch {
              setError("Urmărirea nu s-a salvat. Încearcă din nou.");
            }
          })
        }
      >
        {followed ? (
          <>
            <Check className="size-3.5 group-hover:hidden" strokeWidth={2.2} aria-hidden />
            <X className="hidden size-3.5 group-hover:block" strokeWidth={2.2} aria-hidden />
          </>
        ) : (
          kind === "USER" ? <UserPlus className="size-4" strokeWidth={2.2} aria-hidden /> : <Plus className="size-3.5" strokeWidth={2.2} aria-hidden />
        )}
        {pending ? "Se salvează…" : followed ? "Anulează urmărirea" : "Urmărește"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
