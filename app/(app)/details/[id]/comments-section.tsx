"use client";

import { AtSign, Pencil, Trash2, X } from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { buildMentionToken, mentionTokenEndingAt, parseMentions } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_LENGTH } from "@/server/domain/validation";
import type { TargetType } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";

import {
  addCommentAction,
  type AddCommentState,
  deleteCommentAction,
  editCommentAction,
} from "./comment-actions";

const initialState: AddCommentState = { error: null, ok: false };

// Schițele detaliului, pt dropdown-ul @mention și pt randarea mențiunilor clicabile.
export type MentionSketch = { id: string; authorName: string | null; authorImage: string | null };

export function CommentsSection({
  targetType,
  targetId,
  detailId,
  comments,
  currentUserId,
  currentUserName,
  currentUserImage,
  title = "Dezbatere",
  mentionSketches = [],
  onSelectSketch,
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string; // pagina de revalidat (detaliul-părinte)
  comments: TargetComment[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  title?: string;
  mentionSketches?: MentionSketch[];
  onSelectSketch?: (sketchId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Golește câmpul după ce comentariul s-a adăugat cu succes (reset DOM, nu setState → fără cascadă).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Set-ul id-urilor de schiță care există ACUM (pt randare: mențiunile către schițe șterse → text simplu).
  const validSketchIds = useMemo(() => new Set(mentionSketches.map((s) => s.id)), [mentionSketches]);

  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-bold">
        {title} ·{" "}
        <span className="font-semibold text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comentariu" : "comentarii"}
        </span>
      </h2>

      {/* Composer — poziția ta apare cu rolul tău lângă nume. `@` referă o schiță din teanc. */}
      <form ref={formRef} action={formAction} className="mb-6 flex gap-3">
        <AvatarInitials name={currentUserName ?? null} imageUrl={currentUserImage} size={38} />
        <div className="flex-1">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="detailId" value={detailId} />
          <MentionComposer sketches={mentionSketches} disabled={pending} />
          {state.error && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {state.error}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            {mentionSketches.length > 0 ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#a59a88]">
                <AtSign className="size-3" strokeWidth={2} /> scrie „@” ca să referi o schiță
              </span>
            ) : (
              <span />
            )}
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
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              detailId={detailId}
              isOwner={Boolean(currentUserId && c.authorId === currentUserId)}
              validSketchIds={validSketchIds}
              onSelectSketch={onSelectSketch}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// Compozitor cu autocomplete @schiță: la tastarea `@` (la început de cuvânt) apare un dropdown cu schițele
// detaliului; selectarea inserează un token `@[Nume](sid:id)` în text. Textarea e NECONTROLAT (valoarea o
// gestionăm prin ref la inserția tokenului) → name="body" trimite tokenii pe server (unde se validează
// că aparțin detaliului). Reset-ul câmpului îl face form.reset() din părinte, la succes.
function MentionComposer({ sketches, disabled }: { sketches: MentionSketch[]; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ text: string; at: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  // Detectează un `@query` activ la poziția cursorului (@ la început sau după spațiu; query fără spații).
  function detect(text: string, caret: number) {
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at < 0) return setQuery(null);
    const before = at === 0 ? "" : upto[at - 1];
    if (before && !/\s/.test(before)) return setQuery(null); // @ în interiorul unui cuvânt → nu e mențiune
    const q = upto.slice(at + 1);
    if (/\s/.test(q)) return setQuery(null); // spațiu după @ → mențiunea s-a încheiat
    setHighlight(0);
    setQuery({ text: q, at });
  }

  const matches = query
    ? sketches.filter((s) => (s.authorName ?? "").toLowerCase().includes(query.text.toLowerCase()))
    : [];
  const open = query !== null && sketches.length > 0 && matches.length > 0;

  // Când un autor are mai multe schițe, intrările din listă erau identice (nume+avatar) — imposibil
  // de deosebit care schiță se menționeaza. Numerotăm „schiță N" per autor (ordinea = ordinea taburilor).
  const authorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sketches) {
      const key = s.authorName ?? "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [sketches]);
  const ordinalById = useMemo(() => {
    const seen = new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of sketches) {
      const key = s.authorName ?? "";
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      map.set(s.id, n);
    }
    return map;
  }, [sketches]);

  function pick(s: MentionSketch) {
    const el = ref.current;
    if (!query || !el) return;
    const caret = el.selectionStart ?? el.value.length;
    const baseName = s.authorName ?? "Anonim";
    // Etichetă cu ordinal ("Nume (schița 2)") când autorul are mai multe schițe — rămâne în comentariul
    // salvat, nu doar în dropdown, ca cititorul să știe la care schiță se referă mențiunea.
    const label =
      (authorCounts.get(s.authorName ?? "") ?? 1) > 1
        ? `${baseName} (schița ${ordinalById.get(s.id)})`
        : baseName;
    const token = buildMentionToken(label, s.id);
    el.value = el.value.slice(0, query.at) + token + " " + el.value.slice(caret);
    setQuery(null);
    const pos = query.at + token.length + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        name="body"
        required
        rows={2}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={disabled}
        placeholder="Adaugă la dezbatere — părerea ta apare cu rolul tău lângă nume…"
        onChange={(e) => detect(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onClick={(e) => detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
        onKeyDownCapture={(e) => {
          // Backspace imediat după un token de mențiune → șterge tot tokenul, nu caracter cu caracter
          // (tokenul ascuns e „@[Nume](sid:uuid)", ~50 de caractere greu de șters manual).
          if (e.key !== "Backspace") return;
          const el = e.currentTarget;
          if (el.selectionStart !== el.selectionEnd) return; // selecție activă → comportament nativ
          const caret = el.selectionStart ?? 0;
          const token = mentionTokenEndingAt(el.value, caret);
          if (!token) return;
          e.preventDefault();
          el.value = el.value.slice(0, token.start) + el.value.slice(token.end);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(token.start, token.start);
          });
        }}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full max-w-xs overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {matches.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // păstrează focusul pe textarea
                  pick(s);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                  i === highlight ? "bg-secondary" : "hover:bg-secondary/60",
                )}
              >
                <AvatarInitials name={s.authorName} imageUrl={s.authorImage} size={24} />
                <span className="truncate font-medium">{s.authorName ?? "Anonim"}</span>
                <span className="ml-auto font-mono text-[10px] text-[#a59a88]">
                  {(authorCounts.get(s.authorName ?? "") ?? 1) > 1
                    ? `schița ${ordinalById.get(s.id)}`
                    : "schiță"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Randează corpul unui comentariu cu mențiunile ca butoane (sar la tabul schiței). Mențiunile către
// schițe inexistente (șterse) degradează la text simplu (numele). Fără HTML injection — totul e text.
function CommentBody({
  body,
  validSketchIds,
  onSelectSketch,
}: {
  body: string;
  validSketchIds: Set<string>;
  onSelectSketch?: (sketchId: string) => void;
}) {
  const segments = useMemo(() => parseMentions(body), [body]);
  return (
    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/80">
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        const exists = validSketchIds.has(seg.sketchId) && !!onSelectSketch;
        if (!exists) {
          return (
            <span key={i} className="font-medium text-muted-foreground">
              @{seg.name}
            </span>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectSketch(seg.sketchId)}
            className="rounded font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
          >
            @{seg.name}
          </button>
        );
      })}
    </p>
  );
}

function CommentItem({
  comment: c,
  detailId,
  isOwner,
  validSketchIds,
  onSelectSketch,
}: {
  comment: TargetComment;
  detailId: string;
  isOwner: boolean;
  validSketchIds: Set<string>;
  onSelectSketch?: (sketchId: string) => void;
}) {
  const isDisapproval = Boolean(c.originValidationId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveEdit() {
    setError(null);
    startTransition(async () => {
      const res = await editCommentAction(c.id, detailId, draft);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm("Ștergi comentariul? Acțiunea nu poate fi anulată.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCommentAction(c.id, detailId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <li className="flex gap-3">
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
          <RolePill roleMain={c.authorRoleMain} subRole={c.authorSubRole} verified={c.authorVerification === "VERIFIED"} />
          {isDisapproval && (
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-destructive">
              <X className="size-3" strokeWidth={2.6} />
              dezaprobare
            </span>
          )}
          <span className="font-mono text-[11px] text-[#a59a88]">{formatRelative(c.createdAt)}</span>

          {/* Acțiuni proprii: editare oricând; ștergere doar pe comentariu liber (nu justificare de dezaprobare). */}
          {isOwner && !editing && (
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDraft(c.body);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="size-3" strokeWidth={2} /> Editează
              </button>
              {!isDisapproval && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-3" strokeWidth={2} /> Șterge
                </button>
              )}
            </span>
          )}
        </div>

        {editing ? (
          <div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={COMMENT_MAX_LENGTH}
              autoFocus
            />
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" onClick={saveEdit} disabled={pending}>
                {pending ? "Se salvează…" : "Salvează"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={pending}
              >
                Renunță
              </Button>
            </div>
          </div>
        ) : (
          <CommentBody body={c.body} validSketchIds={validSketchIds} onSelectSketch={onSelectSketch} />
        )}

        {error && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
