"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { renderStrokes, REFERENCE_WIDTH } from "@/lib/sketch-render";
import { STROKE_COLORS, STROKE_WIDTHS, type Stroke } from "@/server/domain/sketch";

// ── Istoric (undo/redo) ──────────────────────────────────────────────────────
type History = { past: Stroke[][]; present: Stroke[]; future: Stroke[][] };
type HistoryAction =
  | { type: "commit"; present: Stroke[] }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "commit":
      return { past: [...state.past, state.present], present: action.present, future: [] };
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
  }
}

const ERASE_THRESHOLD = 0.025; // distanță normalizată sub care radiera „prinde" un stroke

export function SketchCanvas({
  imageUrl,
  initialStrokes,
  onSaveDraft,
  onSend,
  pending = false,
  error = null,
}: {
  imageUrl: string;
  initialStrokes: Stroke[];
  onSaveDraft: (strokes: Stroke[]) => void | Promise<void>;
  onSend: (strokes: Stroke[], thumbnail: Blob | null) => void | Promise<void>;
  pending?: boolean;
  error?: string | null;
}) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialStrokes,
    future: [],
  });
  const [color, setColor] = useState<string>(STROKE_COLORS[0]);
  const [size, setSize] = useState<number>(STROKE_WIDTHS[1]);
  const [eraser, setEraser] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<{ drawing: boolean; points: number[][] }>({ drawing: false, points: [] });

  const present = history.present;

  // Încarcă imaginea-mamă (crossOrigin pentru a putea exporta thumbnail-ul fără taint) + dimensionare responsivă.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let observer: ResizeObserver | null = null;
    img.onload = () => {
      imgRef.current = img;
      const setSize = () => {
        const container = containerRef.current;
        if (!container) return;
        const w = container.clientWidth;
        setDims({ w, h: Math.round(w * (img.naturalHeight / img.naturalWidth)) });
      };
      setSize();
      observer = new ResizeObserver(setSize);
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl]);

  // Redesenează: imaginea-mamă slabă (fill slab) + stroke-urile date + (opțional) stroke-ul în lucru.
  const redraw = useCallback((strokes: Stroke[], temp?: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = imgRef.current;
    if (img) {
      ctx.globalAlpha = 0.3; // semnal vizibil că s-a declanșat schițarea + ajută la desenat peste
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    renderStrokes(ctx, strokes, canvas.width, canvas.height);
    if (temp) renderStrokes(ctx, [temp], canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    redraw(present);
  }, [dims, present, redraw]);

  // ── Desen ──────────────────────────────────────────────────────────────────
  function normPoint(e: React.PointerEvent): number[] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return [x, y];
  }

  function makeTemp(points: number[][]): Stroke {
    return { color, size, points: points.map(([x, y]) => [x, y]) };
  }

  function eraseAt(p: number[]) {
    for (let i = present.length - 1; i >= 0; i--) {
      const hit = present[i].points.some(
        ([x, y]) => Math.hypot(x - p[0], y - p[1]) <= ERASE_THRESHOLD,
      );
      if (hit) {
        dispatch({ type: "commit", present: present.filter((_, idx) => idx !== i) });
        return;
      }
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = normPoint(e);
    if (eraser) {
      drawingRef.current = { drawing: true, points: [] };
      eraseAt(p);
      return;
    }
    drawingRef.current = { drawing: true, points: [p] };
    redraw(present, makeTemp([p]));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current.drawing) return;
    const p = normPoint(e);
    if (eraser) {
      eraseAt(p);
      return;
    }
    drawingRef.current.points.push(p);
    redraw(present, makeTemp(drawingRef.current.points));
  }

  function onPointerUp() {
    const { drawing, points } = drawingRef.current;
    drawingRef.current = { drawing: false, points: [] };
    if (!drawing || eraser || points.length === 0) return;
    const stroke: Stroke = { color, size, points: points.map(([x, y]) => [x, y]) };
    dispatch({ type: "commit", present: [...present, stroke] });
  }

  // Thumbnail PNG (schița peste imaginea-mamă slabă) la lățimea de referință. Best-effort (taint CORS → null).
  async function exportThumbnail(): Promise<Blob | null> {
    const img = imgRef.current;
    if (!img) return null;
    const w = REFERENCE_WIDTH;
    const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalAlpha = 1;
    renderStrokes(ctx, present, w, h);
    return new Promise((resolve) => {
      try {
        off.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
  }

  const isEmpty = present.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Bara de unelte */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Culoare ${c}`}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={`h-6 w-6 rounded-full border-2 ${color === c && !eraser ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-1">
          {STROKE_WIDTHS.map((wsize) => (
            <button
              key={wsize}
              type="button"
              aria-label={`Grosime ${wsize}`}
              onClick={() => {
                setSize(wsize);
                setEraser(false);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${size === wsize && !eraser ? "border-foreground" : "border-input"}`}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: wsize / 2.5, height: wsize / 2.5 }}
              />
            </button>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          size="sm"
          variant={eraser ? "default" : "outline"}
          onClick={() => setEraser((v) => !v)}
        >
          Radieră
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "undo" })}
          disabled={history.past.length === 0}
        >
          ↶ Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "redo" })}
          disabled={history.future.length === 0}
        >
          ↷ Redo
        </Button>
      </div>

      {/* Suprafața de desen */}
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg border border-input">
        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="block w-full touch-none"
          style={{ height: dims.h, cursor: eraser ? "cell" : "crosshair" }}
        />
      </div>

      {/* Acțiuni */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => onSaveDraft(present)}
          disabled={pending || isEmpty}
        >
          Salvează ciorna
        </Button>
        <Button
          type="button"
          className="h-10"
          onClick={async () => onSend(present, await exportThumbnail())}
          disabled={pending || isEmpty}
        >
          {pending ? "Se trimite…" : "Trimite propunerea"}
        </Button>
      </div>
    </div>
  );
}
