"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TargetType } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";

import { addCommentAction, type AddCommentState } from "./comment-actions";

const initialState: AddCommentState = { error: null, ok: false };

export function CommentsSection({
  targetType,
  targetId,
  detailId,
  comments,
  currentUserName,
  currentUserImage,
  title = "Dezbatere",
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  comments: TargetComment[];
  currentUserName?: string | null;
  currentUserImage?: string | null;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Golește câmpul după ce comentariul s-a adăugat cu succes.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-bold">
        {title} ·{" "}
        <span className="font-semibold text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comentariu" : "comentarii"}
        </span>
      </h2>

      {/* Composer — poziția ta apare cu rolul tău lângă nume. */}
      <form ref={formRef} action={formAction} className="mb-6 flex gap-3">
        <AvatarInitials name={currentUserName ?? null} imageUrl={currentUserImage} size={38} />
        <div className="flex-1">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="detailId" value={detailId} />
          <Textarea
            name="body"
            required
            rows={2}
            placeholder="Adaugă la dezbatere — părerea ta apare cu rolul tău lângă nume…"
          />
          {state.error && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {state.error}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Se trimite…" : "Comentează"}
            </Button>
          </div>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Niciun comentariu încă. Pornește dezbaterea.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((c) => {
            const isDisapproval = Boolean(c.originValidationId);
            return (
              <li key={c.id} className="flex gap-3">
                <AvatarInitials name={c.authorName} imageUrl={c.authorImage} size={38} />
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    isDisapproval &&
                      "rounded-r-xl border-l-[3px] border-destructive bg-destructive/[0.06] px-4 py-3",
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{c.authorName ?? "Anonim"}</span>
                    <RolePill
                      roleMain={c.authorRoleMain}
                      verified={c.authorVerification === "VERIFIED"}
                    />
                    {isDisapproval && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-destructive">
                        <X className="size-3" strokeWidth={2.6} />
                        dezaprobare
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-[#a59a88]">
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/80">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
