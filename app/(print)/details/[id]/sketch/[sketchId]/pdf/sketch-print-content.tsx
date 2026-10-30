"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import type { Stroke } from "@/server/domain/sketch";
import { PrintButton } from "../../../pdf/print-button";

export function SketchPrintContent({ backHref, backLabel = "Înapoi la schiță", thumbnailUrl, imageUrl, alt, strokes, children, footer, veil = true }: {
  backHref: string;
  backLabel?: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  alt: string;
  strokes: Stroke[];
  children: ReactNode;
  footer: ReactNode;
  veil?: boolean;
}) {
  const [exportedAt, setExportedAt] = useState<Date | null>(null);
  useEffect(() => {
    function beforePrint() {
      flushSync(() => setExportedAt(new Date()));
    }
    window.addEventListener("beforeprint", beforePrint);
    return () => window.removeEventListener("beforeprint", beforePrint);
  }, []);
  // Fără nicio imagine de recompus nu avem ce aștepta: titlul și nota se pot tipări imediat.
  const nothingToLoad = !!thumbnailUrl || !imageUrl;
  const [imageReady, setImageReady] = useState(nothingToLoad);
  const [drawingReady, setDrawingReady] = useState(nothingToLoad);
  // O imagine deja în cache se poate încărca înainte de hidratare, iar `onLoad` nu mai vine.
  const onImageMounted = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setImageReady(true);
  }, []);
  const [failed, setFailed] = useState(false);
  const onRendered = useCallback(() => setDrawingReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  return (
    <>
      <div className="print-controls mb-6 flex flex-wrap items-center gap-3">
        <Link href={backHref} className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm hover:bg-secondary">{backLabel}</Link>
        <PrintButton disabled={!imageReady || !drawingReady || failed} />
        <p className="w-full text-sm text-muted-foreground">În fereastra de tipărire alege „Save as PDF” / „Salvează ca PDF” și dezactivează „Anteturi și subsoluri”. Exportul include desenul vizibil, autorii și explicațiile foilor exportate, fără discuții.</p>
        {failed && <p role="alert" className="w-full text-sm text-destructive">Imaginea schiței nu a putut fi încărcată. Reîncarcă pagina pentru a încerca din nou.</p>}
      </div>
      <article className="print-document flex flex-col gap-4 break-words rounded-xl border border-border bg-white p-6 text-[#211d18]">
        {children}
        {thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- full-size printable original */
          <img src={thumbnailUrl} alt={alt} className="max-h-[180mm] w-full object-contain" />
        ) : imageUrl ? (
          <div className="relative w-full break-inside-avoid" data-testid="sketch-print-fallback">
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size printable original */}
            <img ref={onImageMounted} src={imageUrl} alt={alt} className="max-h-[180mm] w-full object-contain" onLoad={() => setImageReady(true)} onError={onError} />
            <SketchViewer imageUrl={imageUrl} strokes={strokes} veil={veil} resolutionScale={3} onRendered={onRendered} onError={onError} />
          </div>
        ) : <p className="text-sm text-muted-foreground">Imaginea schiței nu e disponibilă.</p>}
        {footer}
        {exportedAt && <p className="text-sm">Data și ora exportului: <time dateTime={exportedAt.toISOString()}>{exportedAt.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "medium" })}</time> (ora României)</p>}
      </article>
    </>
  );
}
