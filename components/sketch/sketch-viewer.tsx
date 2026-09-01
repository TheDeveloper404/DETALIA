"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { renderStrokes, sketchTransform } from "@/lib/sketch-render";
import {
  computeExtent,
  isUnitExtent,
  type SketchExtent,
  type Stroke,
} from "@/server/domain/sketch";

// Overlay read-only: DOAR stroke-urile schiței, suprapuse peste imaginea-mamă deja randată de părinte
// (<Image fill object-contain> permanent montată în cutia 4/3). Canvas-ul se poziționează exact pe
// dreptunghiul „contain" al imaginii în cutie — imaginea nu se remontează la comutarea taburilor,
// deci nimic nu „pocnește"/tremură; doar stroke-urile apar/dispar deasupra ei.
// `veil`: foaia semitransparentă peste detaliul-mamă. Are sens la SCHIȚA ALTCUIVA (semnal că te uiți la
// propunerea lui peste desenul mamă). La ADNOTAREA autorului pe propria imagine e greșit — nu e o foaie
// pusă peste altceva, sunt notițe pe propriul desen; estomparea ar face imaginea doar mai greu de citit.
//
// PASTEBOARD (2026-09-01): dacă schița are desen în AFARA imaginii (`extent` mai mare decât [0,1]²),
// overlay-ul nu mai ajunge — imaginea trebuie micșorată ca să încapă și desenul din jur. Atunci
// preluăm randarea complet (`PasteboardSketchViewer`): desenăm imaginea + vălul + stroke-urile pe
// canvas, la scara extent-ului, cu zoom/pan ca cititorul să se poată apropia. Părintele NU mai
// randează `<Image>`-ul lui în acest caz (vezi `detail-workspace.tsx`). Schițele normale (fără desen
// în afară) rămân pe calea veche, neatinsă.
export function SketchViewer({
  imageUrl,
  strokes,
  veil = true,
}: {
  imageUrl: string;
  strokes: Stroke[];
  veil?: boolean;
}) {
  // Memoizat: la un stack plin `strokes` are zeci de mii de puncte, iar workspace-ul re-randează la
  // fiecare tastă în comentarii (vezi nota din detail-workspace.tsx).
  const extent = useMemo(() => computeExtent(strokes), [strokes]);
  if (!isUnitExtent(extent)) {
    return (
      <PasteboardSketchViewer imageUrl={imageUrl} strokes={strokes} veil={veil} extent={extent} />
    );
  }
  return <OverlaySketchViewer imageUrl={imageUrl} strokes={strokes} veil={veil} />;
}

// ── Calea veche: overlay peste imaginea randată de părinte (extent == [0,1]²) ─────────────────────
function OverlaySketchViewer({
  imageUrl,
  strokes,
  veil,
}: {
  imageUrl: string;
  strokes: Stroke[];
  veil: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Avem nevoie de raportul natural al imaginii ca să calculăm dreptunghiul „contain" (identic cu
  // object-contain de pe <Image>). Imaginea e deja afișată de părinte; aici doar îi citim dimensiunile.
  useEffect(() => {
    // FĂRĂ crossOrigin: citim doar naturalWidth/Height (nu desenăm imaginea pe canvas) — cu
    // crossOrigin, un host fără CORS ar face onload să nu mai vină → stroke-urile ar dispărea silențios.
    const img = new Image();
    let observer: ResizeObserver | null = null;
    img.onload = () => {
      const setSize = () => {
        const container = containerRef.current;
        if (!container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const ratio = img.naturalHeight / img.naturalWidth;
        let w = cw;
        let h = cw * ratio;
        if (ch > 0 && h > ch) {
          h = ch;
          w = ch / ratio;
        }
        setRect({ x: (cw - w) / 2, y: (ch - h) / 2, w: Math.round(w), h: Math.round(h) });
      };
      setSize();
      observer = new ResizeObserver(setSize);
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Foaia semitransparentă a schiței peste detaliul-mamă (care rămâne opac, randat de părinte) — IDENTIC
    // cu editorul (sketch-canvas.tsx): schița stă pe o coală translucidă peste detaliu, nu invers.
    if (veil) {
      ctx.fillStyle = "rgba(250,247,241,0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    renderStrokes(ctx, strokes, canvas.width, canvas.height);
  }, [rect, strokes, veil]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas
        ref={canvasRef}
        width={rect.w}
        height={rect.h}
        className="absolute"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
    </div>
  );
}

// ── Calea pasteboard: imagine + văl + stroke-uri pe canvas, la scara extent-ului, cu zoom/pan ─────
const V_ZOOM_MIN = 1;
const V_ZOOM_MAX = 5;
const vClampZoom = (z: number) => Math.min(V_ZOOM_MAX, Math.max(V_ZOOM_MIN, z));

function PasteboardSketchViewer({
  imageUrl,
  strokes,
  veil,
  extent,
}: {
  imageUrl: string;
  strokes: Stroke[];
  veil: boolean;
  extent: SketchExtent;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const spanX = extent.maxX - extent.minX;
  const spanY = extent.maxY - extent.minY;

  // Dreptunghiul „contain" al EXTENT-ului în container (raportul = raportul imaginii × spanY/spanX).
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let observer: ResizeObserver | null = null;
    const place = (ratio: number) => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      let w = cw;
      let h = cw * ratio;
      if (ch > 0 && h > ch) {
        h = ch;
        w = ch / ratio;
      }
      setRect({ x: (cw - w) / 2, y: (ch - h) / 2, w: Math.round(w), h: Math.round(h) });
    };
    img.onload = () => {
      imgRef.current = img;
      const extentRatio = (img.naturalHeight / img.naturalWidth) * (spanY / spanX);
      place(extentRatio);
      observer = new ResizeObserver(() => {
        const cur = imgRef.current;
        if (cur) place((cur.naturalHeight / cur.naturalWidth) * (spanY / spanX));
      });
      if (containerRef.current) observer.observe(containerRef.current);
    };
    // CORS eșuat → randăm fără imagine (văl + stroke-uri), nu lăsăm viewer-ul gol.
    img.onerror = () => {
      imgRef.current = null;
      place((3 / 4) * (spanY / spanX));
      observer = new ResizeObserver(() => place((3 / 4) * (spanY / spanX)));
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl, spanX, spanY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rect.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = sketchTransform(canvas.width, canvas.height, extent);
    const rx = t.toX(0);
    const ry = t.toY(0);
    const rw = t.toX(1) - rx;
    const rh = t.toY(1) - ry;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Sub-zona imaginii: hârtie + imaginea opacă + vălul. Restul canvas-ului rămâne transparent
    // (fără bandă) — se vede fundalul cardului.
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.fillStyle = "#faf7f1";
    ctx.fillRect(rx, ry, rw, rh);
    const img = imgRef.current;
    if (img) ctx.drawImage(img, rx, ry, rw, rh);
    if (veil) {
      ctx.fillStyle = "rgba(250,247,241,0.55)";
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
    // Contur subțire al foii — marchează unde se termină imaginea și începe zona de adnotare.
    ctx.strokeStyle = "rgba(33,29,24,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    renderStrokes(ctx, strokes, canvas.width, canvas.height, extent);
  }, [rect, strokes, veil, extent]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = vClampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom === 1) return;
    dragRef.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      data-testid="pasteboard-viewer"
      className="absolute inset-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={rect.w}
        height={rect.h}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        className="absolute touch-none select-none"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          transform: `translate(${pan.x}px, ${pan.y}px)${zoom !== 1 ? ` scale(${zoom})` : ""}`,
          transformOrigin: "center center",
          cursor: zoom > 1 ? "grab" : "zoom-in",
        }}
      />
    </div>
  );
}
