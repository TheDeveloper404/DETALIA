"use client";

import { Eraser, Redo2, Undo2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";

import { renderStrokes, REFERENCE_WIDTH } from "@/lib/sketch-render";
import { cn } from "@/lib/utils";
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
const FIT_PADDING = 28; // marginea dintre canvas și pereții zonei de lucru

// Mărimea vizuală a punctului-indicator per grosime (doar pt rail, nu afectează desenul).
const DOT_PX = [5, 9, 15];

export type SketchCanvasHandle = {
  getStrokes: () => Stroke[];
  exportThumbnail: () => Promise<Blob | null>;
};

// Suprafața de desen a editorului: rail de unelte (stânga) + canvas fit-to-area (dreapta).
// Logica de desen (perfect-freehand prin renderStrokes, undo/redo, radieră) stă aici; bara de context
// + acțiunile (Salvează/Trimite) stau în shell (sketch-editor) și citesc strokes/thumbnail prin ref.
export const SketchCanvas = forwardRef<
  SketchCanvasHandle,
  {
    imageUrl: string;
    initialStrokes: Stroke[];
    onStrokesCount?: (count: number) => void;
  }
>(function SketchCanvas({ imageUrl, initialStrokes, onStrokesCount }, ref) {
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

  // Expune strokes + export thumbnail pentru butoanele din bara de context.
  useImperativeHandle(
    ref,
    () => ({
      getStrokes: () => present,
      exportThumbnail: async () => {
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
      },
    }),
    [present],
  );

  useEffect(() => {
    onStrokesCount?.(present.length);
  }, [present.length, onStrokesCount]);

  // Încarcă imaginea-mamă (crossOrigin pt export fără taint) + dimensionare fit-to-area (păstrează raportul).
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let observer: ResizeObserver | null = null;
    img.onload = () => {
      imgRef.current = img;
      const fit = () => {
        const c = containerRef.current;
        if (!c) return;
        const availW = c.clientWidth - FIT_PADDING * 2;
        const availH = c.clientHeight - FIT_PADDING * 2;
        if (availW <= 0 || availH <= 0) return;
        const ar = img.naturalHeight / img.naturalWidth;
        let w = availW;
        let h = w * ar;
        if (h > availH) {
          h = availH;
          w = h / ar;
        }
        setDims({ w: Math.round(w), h: Math.round(h) });
      };
      fit();
      observer = new ResizeObserver(fit);
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl]);

  // Redesenează: imaginea-mamă estompată (fill slab 0.3) + stroke-urile + stroke-ul în lucru.
  const redraw = useCallback((strokes: Stroke[], temp?: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = imgRef.current;
    if (img) {
      ctx.globalAlpha = 0.3;
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

  const penActive = !eraser;
  const railBtn =
    "flex items-center justify-center rounded-[10px] border-[1.5px] bg-card transition-colors hover:border-primary disabled:cursor-default disabled:hover:border-border";

  return (
    <div className="flex min-h-0 flex-1">
      {/* RAIL UNELTE */}
      <aside className="z-10 flex w-[86px] flex-none flex-col items-center gap-3.5 overflow-y-auto border-r border-border bg-[#faf8f4] py-4">
        <RailLabel>Culori</RailLabel>
        <div
          className="grid grid-cols-2 gap-2.5 transition-opacity"
          style={{ opacity: penActive ? 1 : 0.5 }}
        >
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Culoare ${c}`}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={cn(
                "size-6 rounded-full ring-offset-[#faf8f4] transition-shadow",
                penActive && color === c
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "ring-1 ring-foreground/15",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <RailDivider />

        <RailLabel>Grosime</RailLabel>
        <div
          className="flex w-full flex-col items-center gap-2 transition-opacity"
          style={{ opacity: penActive ? 1 : 0.5 }}
        >
          {STROKE_WIDTHS.map((w, i) => {
            const on = penActive && size === w;
            return (
              <button
                key={w}
                type="button"
                aria-label={`Grosime ${w}`}
                onClick={() => {
                  setSize(w);
                  setEraser(false);
                }}
                className={cn(railBtn, "h-[38px] w-[52px]", on ? "border-primary bg-[#f6ede4]" : "border-border")}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: DOT_PX[i],
                    height: DOT_PX[i],
                    backgroundColor: on ? color : "#8a8073",
                  }}
                />
              </button>
            );
          })}
        </div>

        <RailDivider />

        <button
          type="button"
          aria-label="Radieră"
          aria-pressed={eraser}
          onClick={() => setEraser((v) => !v)}
          className={cn(railBtn, "h-[46px] w-[52px]", eraser ? "border-primary bg-[#f6ede4]" : "border-border")}
        >
          <Eraser className={cn("size-5", eraser ? "text-primary" : "text-foreground/70")} strokeWidth={1.9} />
        </button>

        <RailDivider />

        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            aria-label="Undo"
            onClick={() => dispatch({ type: "undo" })}
            disabled={history.past.length === 0}
            className={cn(railBtn, "h-10 w-[52px] border-border disabled:opacity-40")}
          >
            <Undo2 className="size-[18px] text-foreground/80" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            aria-label="Redo"
            onClick={() => dispatch({ type: "redo" })}
            disabled={history.future.length === 0}
            className={cn(railBtn, "h-10 w-[52px] border-border disabled:opacity-40")}
          >
            <Redo2 className="size-[18px] text-foreground/80" strokeWidth={1.9} />
          </button>
        </div>
      </aside>

      {/* ZONA DE DESEN */}
      <div
        ref={containerRef}
        className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#efece6]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(#e4e0d8 1px,transparent 1px),linear-gradient(90deg,#e4e0d8 1px,transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <span className="pointer-events-none absolute left-[18px] top-4 z-[3] inline-flex items-center gap-1.5 rounded-[7px] border border-[#e6dccd] bg-white/80 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide text-[#7c7060]">
          <span className="block size-[7px] rounded-full bg-primary" />
          Mod schiță · detaliul-mamă estompat
        </span>

        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="relative z-[4] block touch-none rounded-lg bg-[#faf7f1] shadow-sm ring-1 ring-foreground/10"
          style={{ width: dims.w, height: dims.h, cursor: eraser ? "cell" : "crosshair" }}
        />
      </div>
    </div>
  );
});

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a59a88]">{children}</div>
  );
}
function RailDivider() {
  return <div className="h-px w-[46px] flex-none bg-[#eee6da]" />;
}
