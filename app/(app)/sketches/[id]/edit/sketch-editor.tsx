"use client";

import { NotebookPen, Pencil, Save, Send, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { RolePill } from "@/components/role-pill";
import type { SketchCanvasHandle } from "@/components/sketch/sketch-canvas";
import { cn } from "@/lib/utils";
import { MAX_SKETCH_NOTE_LENGTH, type Stroke } from "@/server/domain/sketch";

import { saveStrokesAction, sendSketchAction } from "./sketch-actions";

// Editorul de schiță (perfect-freehand + engine propriu) nu are nevoie de SSR — pagina e mereu o
// navigare client pe /sketches/[id]/edit. Scos din bundle-ul global ca să nu-l plătească restul site-ului.
const SketchCanvas = dynamic(
  () => import("@/components/sketch/sketch-canvas").then((m) => m.SketchCanvas),
  { ssr: false, loading: () => <div className="flex-1 bg-muted/30" /> },
);

// Shell full-screen al editorului: bară de context (titlu detaliu-mamă + autor + acțiuni) + suprafața de
// desen (SketchCanvas). Acțiunile citesc strokes/thumbnail din canvas prin ref.
export function SketchEditor({
  sketchId,
  detailId,
  imageUrl,
  initialStrokes,
  initialNote,
  detailTitle,
  authorId,
  authorName,
  authorRoleMain,
  authorSubRole,
  authorVerified,
}: {
  sketchId: string;
  detailId: string;
  imageUrl: string;
  initialStrokes: Stroke[];
  initialNote: string | null;
  detailTitle: string;
  authorId: string;
  authorName: string | null;
  authorRoleMain: string | null;
  authorSubRole?: string | null;
  authorVerified: boolean;
}) {
  const router = useRouter();
  const canvasRef = useRef<SketchCanvasHandle>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(initialStrokes.length);
  // Notă separată de desen (2026-07-16) — panou colapsabil, NICIODATĂ suprapus peste canvas (împinge
  // layout-ul, nu flotează peste el). Deschis implicit dacă exista deja o notă (reluare ciornă).
  const [note, setNote] = useState(initialNote ?? "");
  const [noteOpen, setNoteOpen] = useState(!!initialNote);

  const disabled = pending || count === 0;

  async function handleSaveDraft() {
    if (!canvasRef.current) return;
    setPending(true);
    setError(null);
    const res = await saveStrokesAction(sketchId, JSON.stringify(canvasRef.current.getStrokes()), note);
    if (!res.ok) {
      setPending(false);
      setError(res.error ?? "Nu am putut salva.");
      return;
    }
    // Ciorna salvată → direct în „Ciornele mele" (2026-07-18, discoverability: userii nu găseau unde
    // aterizează ciorna — ex. ghicit URL-uri manual). Lista e cea mai clară confirmare: ciorna e sus,
    // cu „Continuă". Nu mai stingem pending (navigăm).
    router.push("/sketches/drafts");
  }

  async function handleSend() {
    if (!canvasRef.current) return;
    setPending(true);
    setError(null);
    const thumbnail = await canvasRef.current.exportThumbnail();
    const fd = new FormData();
    fd.set("sketchId", sketchId);
    fd.set("detailId", detailId);
    fd.set("strokes", JSON.stringify(canvasRef.current.getStrokes()));
    fd.set("note", note);
    if (thumbnail) fd.set("thumbnail", thumbnail, "thumbnail.png");
    const res = await sendSketchAction(fd); // pe succes redirecționează (nu mai revine)
    setPending(false);
    if (res && !res.ok) setError(res.error ?? "Nu am putut trimite.");
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#efece6]">
      {/* BARĂ DE CONTEXT */}
      <header className="z-20 flex h-[60px] flex-none items-center gap-4 border-b border-border bg-secondary px-[18px]">
        <Link
          href={`/details/${detailId}`}
          className="inline-flex flex-none items-center gap-2 rounded-[9px] border border-[#d8cfc0] bg-card px-3.5 py-2 font-heading text-sm font-semibold transition-colors hover:border-primary"
        >
          <X className="size-[15px]" strokeWidth={2} />
          Renunță
        </Link>

        <div className="h-7 w-px flex-none bg-border" />

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="hidden flex-none items-center gap-1.5 rounded-[7px] border border-[#ecdcc8] bg-[#f6ede4] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-primary sm:inline-flex">
            <Pencil className="size-3" strokeWidth={2} />
            Schiță peste
          </span>
          <span className="min-w-0 flex-1 truncate font-heading text-[15.5px] font-bold">
            {detailTitle}
          </span>
          <span className="hidden flex-none items-center gap-2 border-l border-border pl-3 md:inline-flex">
            <span className="font-mono text-xs text-muted-foreground">de</span>
            <Link
              href={`/profile/${authorId}`}
              className="font-heading text-[13.5px] font-semibold text-foreground/80 no-underline hover:underline"
            >
              {authorName ?? "Anonim"}
            </Link>
            <RolePill roleMain={authorRoleMain} subRole={authorSubRole} verified={authorVerified} />
          </span>
        </div>

        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-pressed={noteOpen}
          title="Explică desenul în cuvinte (opțional)"
          className={cn(
            "inline-flex flex-none items-center gap-2 rounded-[9px] border px-2.5 py-2.5 font-heading text-sm font-semibold transition-colors hover:border-primary sm:px-4",
            noteOpen ? "border-primary bg-[#f6ede4] text-primary" : "border-[#d8cfc0] bg-card",
          )}
        >
          <NotebookPen className="size-[15px]" strokeWidth={1.9} />
          <span className="hidden sm:inline">Explicație</span>
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={disabled}
          aria-label="Salvează ciornă"
          className="inline-flex flex-none items-center gap-2 rounded-[9px] border border-[#d8cfc0] bg-card px-2.5 py-2.5 font-heading text-sm font-semibold transition-colors hover:border-primary disabled:opacity-50 sm:px-4"
        >
          <Save className="size-[15px] text-muted-foreground" strokeWidth={1.9} />
          <span className="hidden sm:inline">Salvează ciornă</span>
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
          aria-label={pending ? "Se publică…" : "Publică schița"}
          className="inline-flex flex-none items-center gap-2 rounded-[9px] border border-[#95492e] bg-primary px-2.5 py-2.5 font-heading text-sm font-bold text-primary-foreground transition-colors hover:bg-[#974a2e] disabled:opacity-60 sm:px-4"
        >
          <Send className="size-[15px]" strokeWidth={2} />
          <span className="hidden sm:inline">{pending ? "Se publică…" : "Publică schița"}</span>
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="z-20 flex-none border-b border-destructive/30 bg-destructive/10 px-[18px] py-2 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Explicație în cuvinte — panou colapsabil, ÎMPINGE layout-ul (nu flotează peste canvas). Separat
          de desen intenționat (2026-07-16): tool-ul de Text pe canvas arăta prost când era folosit ca
          explicație generală; asta e locul dedicat pt „ce am vrut să zic prin desen". */}
      {noteOpen && (
        <div className="z-20 flex-none border-b border-border bg-card px-[18px] py-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_SKETCH_NOTE_LENGTH))}
            maxLength={MAX_SKETCH_NOTE_LENGTH}
            rows={2}
            placeholder="Explică aici ce ai vrut să arăți prin desen (opțional) — apare sub schiță, pt cine citește…"
            className="w-full resize-none rounded-[10px] border border-input bg-background px-3.5 py-2.5 font-sans text-sm text-foreground outline-none focus:border-ring"
          />
          <p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">
            {note.length} / {MAX_SKETCH_NOTE_LENGTH}
          </p>
        </div>
      )}

      {/* SUPRAFAȚA DE DESEN */}
      <SketchCanvas
        ref={canvasRef}
        imageUrl={imageUrl}
        initialStrokes={initialStrokes}
        onStrokesCount={setCount}
      />
    </div>
  );
}
