"use client";

import { AtSign, Pencil, Reply, Trash2, X } from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { EmojiPickerButton } from "@/components/emoji-picker-button";
import { RolePill } from "@/components/role-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { mentionsToDisplay, parseMentions, replaceLabelsWithTokens } from "@/lib/mentions";
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
export type MentionSketch = {
  id: string;
  authorName: string | null;
  authorImage: string | null;
  createdAt: Date;
};

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

  // Reply pe UN SINGUR nivel: rădăcinile în ordine cronologică, cu reply-urile lor grupate dedesubt
  // (tot cronologic). Un reply nu poate avea reply — dacă apare cu parentCommentId inexistent printre
  // rădăcini (caz imposibil azi, dar defensiv), cade la rădăcină ca să nu dispară din UI.
  const { roots, repliesByParent } = useMemo(() => {
    const rootIds = new Set(comments.filter((c) => !c.parentCommentId).map((c) => c.id));
    const roots: TargetComment[] = [];
    const repliesByParent = new Map<string, TargetComment[]>();
    for (const c of comments) {
      if (!c.parentCommentId || !rootIds.has(c.parentCommentId)) {
        roots.push(c);
        continue;
      }
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }
    return { roots, repliesByParent };
  }, [comments]);

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
          <MentionComposer sketches={mentionSketches} disabled={pending} resetSignal={state} />
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
          {roots.map((c) => (
            <li key={c.id} className="flex flex-col gap-3">
              <CommentItem
                comment={c}
                detailId={detailId}
                isOwner={Boolean(currentUserId && c.authorId === currentUserId)}
                validSketchIds={validSketchIds}
                onSelectSketch={onSelectSketch}
                targetType={targetType}
                targetId={targetId}
                currentUserName={currentUserName}
                currentUserImage={currentUserImage}
                canReply={!!currentUserId}
              />
              {(repliesByParent.get(c.id) ?? []).length > 0 && (
                <ul className="ml-[52px] flex flex-col gap-3 border-l border-border pl-4">
                  {(repliesByParent.get(c.id) ?? []).map((r) => (
                    <li key={r.id}>
                      <CommentItem
                        comment={r}
                        detailId={detailId}
                        isOwner={Boolean(currentUserId && r.authorId === currentUserId)}
                        validSketchIds={validSketchIds}
                        onSelectSketch={onSelectSketch}
                        isReply
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Compozitor cu autocomplete @schiță: la tastarea `@` (la început de cuvânt) apare un dropdown cu schițele
// detaliului; selectarea inserează în textarea DOAR eticheta lizibilă („@Nume (schița 2)"), nu tokenul
// tehnic `@[Nume](sid:uuid)` (~50 caractere, deranjant la compunere). Maparea etichetă→sid se ține într-un
// ref; corpul cu tokeni se reconstruiește nevăzut într-un <input hidden name="body"> la fiecare modificare
// → serverul primește același format ca înainte (validat că sid-urile aparțin detaliului).
// Textarea e NECONTROLAT; reset-ul câmpurilor îl face form.reset() din părinte, la succes.
function MentionComposer({
  sketches,
  disabled,
  resetSignal,
}: {
  sketches: MentionSketch[];
  disabled?: boolean;
  resetSignal?: AddCommentState; // identitate nouă la fiecare rezultat de acțiune; .ok = succes
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const labelsRef = useRef(new Map<string, string>()); // etichetă afișată → sketchId
  const [query, setQuery] = useState<{ text: string; at: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [tooLong, setTooLong] = useState(false);

  // După un comentariu trimis cu succes, golește maparea etichetă→sid — altfel un „@Nume" scris de
  // mână în comentariul URMĂTOR s-ar tokeniza automat (greșit). Doar refs → fără cascadă de render.
  useEffect(() => {
    if (resetSignal?.ok) labelsRef.current.clear();
  }, [resetSignal]);

  // Reconstruiește corpul cu tokeni din textul afișat (înlocuire cu graniță de cuvânt — vezi
  // replaceLabelsWithTokens: „@Ana" nu se potrivește în „@Anatol").
  function syncHidden(displayText: string) {
    const out = replaceLabelsWithTokens(displayText, labelsRef.current);
    if (hiddenRef.current) hiddenRef.current.value = out;
    // Tokenii expandați (~+45 char/mențiune) pot împinge corpul REAL peste limită deși textul afișat
    // e sub maxLength — serverul respinge oricum; aici doar avertizăm din timp, lizibil.
    setTooLong(out.length > COMMENT_MAX_LENGTH);
  }

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
  // Ordinal STABIL după data creării (prima schiță a autorului = 1, fix) — NU după `sketches` (ordinea
  // taburilor, cea mai nouă primă). Altfel, la fiecare schiță nouă, etichetele mai vechi s-ar renumerota
  // (bug raportat de Liviu 2026-07-07: schița de azi devenea „1", cea de ieri „2" — vezi detail-workspace.tsx).
  const ordinalById = useMemo(() => {
    const byAuthorAsc = [...sketches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const seen = new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of byAuthorAsc) {
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
    // Fără paranteze în etichetă (buildMentionToken le curăță) → „Nume — schița 2", identic afișat și în token.
    const label = (
      (authorCounts.get(s.authorName ?? "") ?? 1) > 1
        ? `${baseName} — schița ${ordinalById.get(s.id)}`
        : baseName
    ).replace(/[\]()\r\n]/g, " ").trim() || "Anonim";
    labelsRef.current.set(label, s.id);
    el.value = el.value.slice(0, query.at) + "@" + label + " " + el.value.slice(caret);
    syncHidden(el.value);
    setQuery(null);
    const pos = query.at + label.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  // Inserează emoji la poziția cursorului (fără să atingă mențiunile @) — sincronizat prin syncHidden,
  // exact ca la `pick()`, doar fără maparea etichetă→sid.
  function insertEmoji(emoji: string) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, caret) + emoji + el.value.slice(caret);
    syncHidden(el.value);
    const pos = caret + emoji.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <input ref={hiddenRef} type="hidden" name="body" />
      <div className="absolute right-1.5 top-1.5 z-[1]">
        <EmojiPickerButton onPick={insertEmoji} disabled={disabled} />
      </div>
      <Textarea
        ref={ref}
        required
        rows={2}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={disabled}
        placeholder="Adaugă la dezbatere — părerea ta apare cu rolul tău lângă nume…"
        onChange={(e) => {
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
          syncHidden(e.target.value);
        }}
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
          // Backspace imediat după o mențiune afișată („@Etichetă") → șterge toată mențiunea dintr-o
          // apăsare (o etichetă ruptă pe la mijloc n-ar mai fi recunoscută la reconstruirea tokenului).
          if (e.key !== "Backspace") return;
          const el = e.currentTarget;
          if (el.selectionStart !== el.selectionEnd) return; // selecție activă → comportament nativ
          const caret = el.selectionStart ?? 0;
          const upto = el.value.slice(0, caret);
          let hit: string | null = null;
          for (const label of labelsRef.current.keys()) {
            if (upto.endsWith(`@${label}`) && (!hit || label.length > hit.length)) hit = label;
          }
          if (!hit) return;
          e.preventDefault();
          const start = caret - hit.length - 1;
          el.value = el.value.slice(0, start) + el.value.slice(caret);
          syncHidden(el.value);
          detect(el.value, start); // reîmprospătează starea dropdown-ului (altfel rămâne stale o tastă)
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start, start);
          });
        }}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {tooLong && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          Comentariul depășește limita după includerea mențiunilor — scurtează textul.
        </p>
      )}
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
  targetType,
  targetId,
  currentUserName,
  currentUserImage,
  canReply = false,
  isReply = false,
}: {
  comment: TargetComment;
  detailId: string;
  isOwner: boolean;
  validSketchIds: Set<string>;
  onSelectSketch?: (sketchId: string) => void;
  // Reply — UN SINGUR nivel: doar comentariile RĂDĂCINĂ primesc buton „Răspunde" (isReply=false).
  targetType?: TargetType;
  targetId?: string;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  canReply?: boolean;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const isDisapproval = Boolean(c.originValidationId);
  // Dezaprobare RETRASĂ: era justificare (wasDisapproval), dar poziția a fost retrasă (originValidationId
  // → null, onDelete: set null) — istoricul nu se șterge, dar fără etichetă ar arăta ca un comentariu
  // obișnuit, deși userul a luat public o poziție de dezaprobare la un moment dat (2026-07-06).
  const isRetractedDisapproval = c.wasDisapproval && !c.originValidationId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // La editare, corpul stocat (cu tokeni `@[Nume](sid:uuid)`) se afișează ca text lizibil (`@Nume`);
  // maparea etichetă→sid se ține aici și corpul cu tokeni se reconstruiește la salvare (server-ul
  // re-validează oricum sid-urile). Mențiuni NOI nu se pot adăuga din editare (fără autocomplete aici).
  const editLabelsRef = useRef(new Map<string, string>());
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    const { display, labels } = mentionsToDisplay(c.body);
    editLabelsRef.current = labels;
    setDraft(display);
    setEditing(true);
  }

  function saveEdit() {
    setError(null);
    startTransition(async () => {
      const res = await editCommentAction(
        c.id,
        detailId,
        replaceLabelsWithTokens(draft, editLabelsRef.current),
      );
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
          {isRetractedDisapproval && (
            <span
              title="Poziția de dezaprobare a fost retrasă ulterior — comentariul rămâne, ca istoric"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground"
            >
              <X className="size-3" strokeWidth={2.6} />
              fostă dezaprobare · retrasă
            </span>
          )}
          {/* suppressHydrationWarning: formatRelative() e f(Date.now()) — server randează la un moment,
              clientul hidratează la altul → text diferit garantat, e un mismatch așteptat, nu un bug real
              (vezi React docs, „Suppressing unavoidable hydration mismatch errors"). */}
          <span className="font-mono text-[11px] text-[#a59a88]" suppressHydrationWarning>
            {formatRelative(c.createdAt)}
          </span>

          {/* Acțiuni proprii: editare oricând; ștergere doar pe comentariu liber (nu justificare de dezaprobare). */}
          {isOwner && !editing && (
            <span className={cn("flex items-center gap-1", !canReply || isReply ? "ml-auto" : undefined)}>
              <button
                type="button"
                onClick={startEdit}
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
          {/* „Răspunde" — DOAR pe rădăcină (reply-urile nu mai au propriul buton — un singur nivel). */}
          {!isReply && canReply && !editing && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                !isOwner && "ml-auto",
              )}
            >
              <Reply className="size-3" strokeWidth={2} /> Răspunde
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <div className="relative">
              <div className="absolute right-1.5 top-1.5 z-[1]">
                <EmojiPickerButton
                  onPick={(emoji) => {
                    const el = editTextareaRef.current;
                    const caret = el?.selectionStart ?? draft.length;
                    const next = draft.slice(0, caret) + emoji + draft.slice(caret);
                    setDraft(next);
                    const pos = caret + emoji.length;
                    requestAnimationFrame(() => {
                      el?.focus();
                      el?.setSelectionRange(pos, pos);
                    });
                  }}
                  disabled={pending}
                />
              </div>
              <Textarea
                ref={editTextareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={COMMENT_MAX_LENGTH}
                autoFocus
              />
            </div>
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

        {replying && targetType && targetId && (
          <ReplyComposer
            targetType={targetType}
            targetId={targetId}
            detailId={detailId}
            parentCommentId={c.id}
            currentUserName={currentUserName}
            currentUserImage={currentUserImage}
            onDone={() => setReplying(false)}
          />
        )}
      </div>
    </li>
  );
}

// Compozitor de reply — form separat (propriul useActionState), fără autocomplete @schiță (scop redus,
// suficient pt un răspuns scurt). Se închide singur după trimitere reușită.
function ReplyComposer({
  targetType,
  targetId,
  detailId,
  parentCommentId,
  currentUserName,
  currentUserImage,
  onDone,
}: {
  targetType: TargetType;
  targetId: string;
  detailId: string;
  parentCommentId: string;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (state.ok) doneRef.current();
  }, [state]);

  // Textarea necontrolat (name="body" citit direct din FormData la submit) — inserăm emoji direct în DOM.
  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, caret) + emoji + el.value.slice(caret);
    const pos = caret + emoji.length;
    el.focus();
    el.setSelectionRange(pos, pos);
  }

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex gap-2.5">
      <AvatarInitials name={currentUserName ?? null} imageUrl={currentUserImage} size={30} />
      <div className="relative flex-1">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="detailId" value={detailId} />
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
        <div className="absolute right-1.5 top-1.5 z-[1]">
          <EmojiPickerButton onPick={insertEmoji} disabled={pending} />
        </div>
        <Textarea
          ref={textareaRef}
          name="body"
          required
          autoFocus
          rows={2}
          maxLength={COMMENT_MAX_LENGTH}
          disabled={pending}
          placeholder="Scrie un răspuns…"
        />
        {state.error && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {state.error}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Se trimite…" : "Răspunde"}
          </Button>
        </div>
      </div>
    </form>
  );
}
