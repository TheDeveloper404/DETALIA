"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import type { Stroke } from "@/server/domain/sketch";
import { PrintButton } from "../../../pdf/print-button";

export function SketchPrintContent({ backHref, thumbnailUrl, imageUrl, alt, strokes, children, footer }: {
  backHref: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  alt: string;
  strokes: Stroke[];
  children: ReactNode;
  footer: ReactNode;
}) {
  const [imageReady, setImageReady] = useState(!!thumbnailUrl);
  const [drawingReady, setDrawingReady] = useState(!!thumbnailUrl);
  const [failed, setFailed] = useState(false);
  const onRendered = useCallback(() => setDrawingReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  return (
    <>
      <div className="print-controls mb-6 flex flex-wrap items-center gap-3">
        <Link href={backHref} className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm hover:bg-secondary">Înapoi la schiță</Link>
        <PrintButton disabled={!imageReady || !drawingReady || failed} />
        <p className="w-full text-sm text-muted-foreground">În fereastra de tipărire alege „Save as PDF” / „Salvează ca PDF”. Exportul include schița și nota autorului, fără discuții.</p>
        {failed && <p role="alert" className="w-full text-sm text-destructive">Imaginea schiței nu a putut fi încărcată. Reîncarcă pagina pentru a încerca din nou.</p>}
      </div>
      <article className="flex flex-col gap-4">
        {children}
        {thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- full-size printable original */
          <img src={thumbnailUrl} alt={alt} className="max-h-[220mm] w-full object-contain" />
        ) : imageUrl ? (
          <div className="relative w-full break-inside-avoid" data-testid="sketch-print-fallback">
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size printable original */}
            <img src={imageUrl} alt={alt} className="max-h-[220mm] w-full object-contain" onLoad={() => setImageReady(true)} onError={onError} />
            <SketchViewer imageUrl={imageUrl} strokes={strokes} resolutionScale={3} onRendered={onRendered} onError={onError} />
          </div>
        ) : <p className="text-sm text-muted-foreground">Imaginea schiței nu e disponibilă.</p>}
        {footer}
      </article>
    </>
  );
}
