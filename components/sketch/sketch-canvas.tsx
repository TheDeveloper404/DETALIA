"use client";

import {
  ArrowUpRight,
  Circle,
  Eraser,
  Pencil,
  Redo2,
  Slash,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  renderStrokes,
  REFERENCE_WIDTH,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SCALE,
} from "@/lib/sketch-render";
import { cn } from "@/lib/utils";
import { MAX_TEXT_LENGTH, STROKE_COLORS, STROKE_WIDTHS, type Stroke } from "@/server/domain/sketch";

// Uneltele de desen din rail. „pen" freehand · forme cu 2 capete (line/rect/ellipse/arrow) · „text" casetă · „eraser".
type Tool = "pen" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";
const SHAPE_TOOLS = ["line", "rect", "ellipse", "arrow"] as const;
function isShapeTool(t: Tool): t is (typeof SHAPE_TOOLS)[number] {
  return (SHAPE_TOOLS as readonly string[]).includes(t);
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// Uneltele de desen din rail (ordine + iconițe). Radiera și undo/redo stau separat.
const TOOL_ITEMS: { value: Tool; label: string; Icon: typeof Pencil }[] = [
  { value: "pen", label: "Creion", Icon: Pencil },
  { value: "line", label: "Linie dreaptă", Icon: Slash },
  { value: "rect", label: "Dreptunghi", Icon: Square },
  { value: "ellipse", label: "Cerc", Icon: Circle },
  { value: "arrow", label: "Săgeată", Icon: ArrowUpRight },
  { value: "text", label: "Text", Icon: Type },
];

// ── Hit-test radieră (coordonate normalizate) — distanță punct→segment + cazuri per formă ─────────────
function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function strokeHit(s: Stroke, px: number, py: number, th: number): boolean {
  const pts = s.points;
  if (pts.length === 0) return false;
  const kind = s.kind ?? "free";
  const a = pts[0];
  const b = pts[pts.length - 1];

  if (kind === "text") {
    // Aproximăm caseta în spațiu normalizat (fără măsurarea reală a fontului).
    const fontNorm = (s.size * TEXT_FONT_SCALE) / REFERENCE_WIDTH;
    const lines = (s.text ?? "").split("\n");
    const cols = Math.max(1, ...lines.map((l) => l.length));
    const w = cols * fontNorm * 0.6;
    const h = lines.length * fontNorm * 1.25;
    return px >= a[0] - th && px <= a[0] + w + th && py >= a[1] - th && py <= a[1] + h + th;
  }
  if (kind === "line" || kind === "arrow") {
    return pointSegDist(px, py, a[0], a[1], b[0], b[1]) <= th;
  }
  if (kind === "rect") {
    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);
    return (
      Math.min(
        pointSegDist(px, py, x0, y0, x1, y0),
        pointSegDist(px, py, x1, y0, x1, y1),
        pointSegDist(px, py, x1, y1, x0, y1),
        pointSegDist(px, py, x0, y1, x0, y0),
      ) <= th
    );
  }
  if (kind === "ellipse") {
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;
    const rx = Math.abs(b[0] - a[0]) / 2;
    const ry = Math.abs(b[1] - a[1]) / 2;
    if (rx < 1e-4 || ry < 1e-4) return pointSegDist(px, py, a[0], a[1], b[0], b[1]) <= th;
    const ang = Math.atan2((py - cy) / ry, (px - cx) / rx);
    return Math.hypot(px - (cx + rx * Math.cos(ang)), py - (cy + ry * Math.sin(ang))) <= th;
  }
  // free: distanță la oricare segment al traseului (sau la punct dacă e unul singur).
  if (pts.length === 1) return Math.hypot(px - a[0], py - a[1]) <= th;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointSegDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= th) return true;
  }
  return false;
}

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
  const [tool, setTool] = useState<Tool>("pen");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  // Caseta de text în curs de tastare (poziție normalizată 0..1 + valoare). null = niciuna deschisă.
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const drawingRef = useRef<{ drawing: boolean; points: number[][] }>({ drawing: false, points: [] });
  // Radieră: setul de stroke-uri șterse într-o singură tragere (un singur pas de undo la final).
  const eraseRef = useRef<{ base: Stroke[]; removed: Set<number> } | null>(null);

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
    // Grila pe FOAIE (nu pe fundalul zonei) — desenată pe canvas, deci NU intră în thumbnail-ul exportat.
    const step = 26;
    ctx.strokeStyle = "rgba(120,105,80,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = step; gx < canvas.width; gx += step) {
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, canvas.height);
    }
    for (let gy = step; gy < canvas.height; gy += step) {
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(canvas.width, gy + 0.5);
    }
    ctx.stroke();
    const img = imgRef.current;
    if (img) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    renderStrokes(ctx, strokes, canvas.width, canvas.height);
    if (temp) renderStrokes(ctx, [temp], canvas.width, canvas.height);
  }, []);

  // Zoom cu Ctrl/Cmd + rotița mouse-ului (listener non-passive ca să putem preveni scroll-ul paginii).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
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

  function makeStroke(points: number[][], kind: Stroke["kind"]): Stroke {
    return { color, size, kind, points: points.map(([x, y]) => [x, y]) };
  }

  // Fixează caseta de text în lucru (dacă are conținut) ca stroke și închide input-ul.
  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      const stroke: Stroke = {
        color,
        size,
        kind: "text",
        text: textDraft.value.trim().slice(0, MAX_TEXT_LENGTH),
        points: [[textDraft.x, textDraft.y]],
      };
      dispatch({ type: "commit", present: [...present, stroke] });
    }
    setTextDraft(null);
  }

  // Focus pe input-ul flotant când se deschide o casetă nouă.
  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  // Aplică radiera la un punct: marchează stroke-urile atinse (geometric) și redesenează vederea filtrată.
  function applyErase(p: number[]) {
    const er = eraseRef.current;
    if (!er) return;
    for (let i = 0; i < er.base.length; i++) {
      if (!er.removed.has(i) && strokeHit(er.base[i], p[0], p[1], ERASE_THRESHOLD)) {
        er.removed.add(i);
      }
    }
    redraw(er.base.filter((_, i) => !er.removed.has(i)));
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = normPoint(e);
    if (tool === "text") {
      // Click pe canvas: fixează caseta anterioară (dacă există) și deschide una nouă aici.
      commitText();
      setTextDraft({ x: p[0], y: p[1], value: "" });
      return;
    }
    canvasRef.current?.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      drawingRef.current = { drawing: true, points: [] };
      eraseRef.current = { base: present, removed: new Set() };
      applyErase(p);
      return;
    }
    if (isShapeTool(tool)) {
      // Formele țin capătul de start + capătul curent (index 1, actualizat la move).
      drawingRef.current = { drawing: true, points: [p, p] };
      redraw(present, makeStroke([p, p], tool));
      return;
    }
    drawingRef.current = { drawing: true, points: [p] };
    redraw(present, makeStroke([p], "free"));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current.drawing) return;
    const p = normPoint(e);
    if (tool === "eraser") {
      applyErase(p);
      return;
    }
    if (isShapeTool(tool)) {
      drawingRef.current.points = [drawingRef.current.points[0], p];
      redraw(present, makeStroke(drawingRef.current.points, tool));
      return;
    }
    drawingRef.current.points.push(p);
    redraw(present, makeStroke(drawingRef.current.points, "free"));
  }

  function onPointerUp() {
    const { drawing, points } = drawingRef.current;
    drawingRef.current = { drawing: false, points: [] };
    if (tool === "eraser") {
      // Un singur commit la finalul tragerii → un singur pas de undo.
      const er = eraseRef.current;
      eraseRef.current = null;
      if (er && er.removed.size > 0) {
        dispatch({ type: "commit", present: er.base.filter((_, i) => !er.removed.has(i)) });
      }
      return;
    }
    if (!drawing || points.length === 0) return;
    if (isShapeTool(tool)) {
      const start = points[0];
      const end = points[points.length - 1];
      // Ignoră un click fără tragere (formă degenerată).
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.005) return;
      dispatch({ type: "commit", present: [...present, makeStroke([start, end], tool)] });
      return;
    }
    dispatch({ type: "commit", present: [...present, makeStroke(points, "free")] });
  }

  const drawActive = tool !== "eraser";
  const textFontPx = size * (dims.w / REFERENCE_WIDTH) * TEXT_FONT_SCALE;
  const railBtn =
    "flex items-center justify-center rounded-[10px] border-[1.5px] bg-card transition-colors hover:border-primary disabled:cursor-default disabled:hover:border-border";

  return (
    <div className="flex min-h-0 flex-1">
      {/* RAIL UNELTE */}
      <aside className="z-10 flex w-[86px] flex-none flex-col items-center gap-3.5 overflow-y-auto border-r border-border bg-[#faf8f4] py-4">
        <RailLabel>Unealtă</RailLabel>
        <div className="grid w-full grid-cols-2 justify-items-center gap-1.5 px-1.5">
          {TOOL_ITEMS.map(({ value, label, Icon }) => {
            const active = tool === value;
            return (
              <button
                key={value}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={active}
                onClick={() => setTool(value)}
                className={cn(railBtn, "h-[38px] w-full", active ? "border-primary bg-[#f6ede4]" : "border-border")}
              >
                <Icon className={cn("size-[18px]", active ? "text-primary" : "text-foreground/70")} strokeWidth={1.9} />
              </button>
            );
          })}
        </div>

        <RailDivider />

        <RailLabel>Culori</RailLabel>
        <div
          className="grid grid-cols-2 gap-2.5 transition-opacity"
          style={{ opacity: drawActive ? 1 : 0.5 }}
        >
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Culoare ${c}`}
              onClick={() => {
                setColor(c);
                if (tool === "eraser") setTool("pen");
              }}
              className={cn(
                "size-6 rounded-full ring-offset-[#faf8f4] transition-shadow",
                drawActive && color === c
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
          style={{ opacity: drawActive ? 1 : 0.5 }}
        >
          {STROKE_WIDTHS.map((w, i) => {
            const on = drawActive && size === w;
            return (
              <button
                key={w}
                type="button"
                aria-label={`Grosime ${w}`}
                onClick={() => {
                  setSize(w);
                  if (tool === "eraser") setTool("pen");
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
          aria-pressed={tool === "eraser"}
          onClick={() => setTool((t) => (t === "eraser" ? "pen" : "eraser"))}
          className={cn(railBtn, "h-[46px] w-[52px]", tool === "eraser" ? "border-primary bg-[#f6ede4]" : "border-border")}
        >
          <Eraser className={cn("size-5", tool === "eraser" ? "text-primary" : "text-foreground/70")} strokeWidth={1.9} />
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
        <span className="pointer-events-none absolute left-[18px] top-4 z-[3] inline-flex items-center gap-1.5 rounded-[7px] border border-[#e6dccd] bg-white/80 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide text-[#7c7060]">
          <span className="block size-[7px] rounded-full bg-primary" />
          Mod schiță · detaliul-mamă estompat
        </span>

        {/* Controale zoom */}
        <div className="absolute bottom-4 right-4 z-[5] flex items-center gap-0.5 rounded-lg border border-[#e6dccd] bg-white/90 p-1 shadow-sm">
          <button
            type="button"
            aria-label="Micșorează"
            onClick={() => setZoom((z) => clampZoom(z * 0.9))}
            className="flex size-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ZoomOut className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Resetează zoom"
            onClick={() => setZoom(1)}
            className="min-w-[42px] rounded-md px-1 py-0.5 font-mono text-[11px] text-foreground/70 transition-colors hover:bg-secondary"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Mărește"
            onClick={() => setZoom((z) => clampZoom(z * 1.1))}
            className="flex size-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ZoomIn className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* Wrapper la dimensiunea exactă a foii (scalat de zoom) → ancorează rigle + input-ul flotant de text. */}
        <div
          className="relative z-[4]"
          style={{
            width: dims.w,
            height: dims.h,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "center center",
          }}
        >
          {/* Rigle (ticks la 26px = pasul grilei) pe marginile de sus și stânga, în afara foii. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[15px] left-0 h-[11px] w-full rounded-t-[3px] border border-[#e2dac9] bg-[#f5f0e6]"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(120,105,80,0.5) 0 1px, transparent 1px 26px)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-[15px] top-0 h-full w-[11px] rounded-l-[3px] border border-[#e2dac9] bg-[#f5f0e6]"
            style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(120,105,80,0.5) 0 1px, transparent 1px 26px)" }}
          />

          <canvas
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            // Previne focus-steal-ul nativ (mousedown mută focusul pe body) care altfel ar închide instant
            // caseta de text abia deschisă (onBlur → commit gol). Desenul merge pe pointer events, neafectat.
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="block touch-none rounded-lg bg-[#faf7f1] shadow-sm ring-1 ring-foreground/10"
            style={{
              width: dims.w,
              height: dims.h,
              cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair",
            }}
          />

          {textDraft && (
            <textarea
              ref={textInputRef}
              value={textDraft.value}
              maxLength={MAX_TEXT_LENGTH}
              rows={1}
              onChange={(e) => {
                // Auto-grow pe înălțime ca rândurile (shift+Enter) să fie vizibile.
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                setTextDraft((d) => (d ? { ...d, value: e.target.value } : d));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextDraft(null);
                }
              }}
              onBlur={commitText}
              placeholder="scrie…"
              className="absolute z-[6] resize-none overflow-hidden whitespace-pre rounded-[2px] p-0 outline-none placeholder:text-foreground/25"
              style={{
                left: textDraft.x * dims.w,
                top: textDraft.y * dims.h,
                color,
                caretColor: color,
                // Fundal-hârtie subtil DOAR cât tastezi (lizibilitate) — fără bordură; la fixare devine text cu halou.
                background: "rgba(250,247,241,0.6)",
                fontFamily: TEXT_FONT_FAMILY,
                fontWeight: 600,
                fontSize: textFontPx,
                lineHeight: 1.3,
                minWidth: 40,
                maxWidth: dims.w - textDraft.x * dims.w,
              }}
            />
          )}
        </div>
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
