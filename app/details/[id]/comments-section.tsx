"use client";

import { useActionState, useEffect, useRef } from "react";

import { AuthorBadge } from "@/components/author-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TargetType } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";

import { addCommentAction, type AddCommentState } from "./comment-actions";

const initialState: AddCommentState = { error: null, ok: false };

export function CommentsSection({
  targetType,
  targetId,
  detailId,
  comments,
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  comments: TargetComment[];
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Golește câmpul după ce comentariul s-a adăugat cu succes.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">Comentarii ({comments.length})</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Niciun comentariu încă.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <AuthorBadge
                  name={c.authorName}
                  roleMain={c.authorRoleMain}
                  subRole={c.authorSubRole}
                  verified={c.authorVerification === "VERIFIED"}
                />
                {c.originValidationId && (
                  <Badge variant="destructive">dezaprobare</Badge>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-2 border-t border-border pt-3"
      >
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="detailId" value={detailId} />
        <Textarea name="body" required rows={3} placeholder="Adaugă un comentariu…" />
        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Se trimite…" : "Comentează"}
        </Button>
      </form>
    </section>
  );
}
