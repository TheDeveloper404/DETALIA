"use client";
import { useState, useTransition } from "react";
import { setFollowAction } from "@/app/(app)/following/actions";

export function FollowButton({
  kind,
  targetId,
  followed,
  label,
}: {
  kind: "USER" | "CATEGORY";
  targetId: string;
  followed: boolean;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={followed}
        disabled={pending}
        className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
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
        {pending ? "Se salvează…" : followed ? "Nu mai urmări " + label : "Urmărește " + label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
