"use client";

import { useActionState, useEffect, useRef } from "react";

import { AuthorBadge } from "@/components/author-badge";
import type { TargetComment } from "@/server/repos/commentsRepo";

import { addCommentAction, type AddCommentState } from "./comment-actions";

const initialState: AddCommentState = { error: null, ok: false };

export function CommentsSection({
  detailId,
  comments,
}: {
  detailId: string;
  comments: TargetComment[];
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Golește câmpul după ce comentariul s-a adăugat cu succes.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Comentarii ({comments.length})
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Niciun comentariu încă.</p>
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
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
                    dezaprobare
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <input type="hidden" name="detailId" value={detailId} />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Adaugă un comentariu…"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Se trimite…" : "Comentează"}
        </button>
      </form>
    </section>
  );
}
