"use client";

import { Pencil, Save, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { RolePill } from "@/components/role-pill";
import { SketchCanvas, type SketchCanvasHandle } from "@/components/sketch/sketch-canvas";
import type { Stroke } from "@/server/domain/sketch";

import { saveStrokesAction, sendSketchAction } from "./sketch-actions";

// Shell full-screen al editorului: bară de context (titlu detaliu-mamă + autor + acțiuni) + suprafața de
// desen (SketchCanvas) + toast „ciornă salvată". Acțiunile citesc strokes/thumbnail din canvas prin ref.
export function SketchEditor({
  sketchId,
  detailId,
  imageUrl,
  initialStrokes,
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

  const disabled = pending || count === 0;

  async function handleSaveDraft() {
    if (!canvasRef.current) return;
    setPending(true);
    setError(null);
    const res = await saveStrokesAction(sketchId, JSON.stringify(canvasRef.current.getStrokes()));
    if (!res.ok) {
      setPending(false);
      setError(res.error ?? "Nu am putut salva.");
      return;
    }
    // Ciorna salvată → înapoi în detaliu (o reiei oricând din teanc). Nu mai stingem pending (navigăm).
    router.push(`/details/${detailId}`);
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
