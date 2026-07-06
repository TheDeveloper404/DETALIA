"use client";

import {
  ArrowUpRight,
  Circle,
  Eraser,
  Minus,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Slash,
  Square,
  Trash2,
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
import {
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
  STROKE_COLORS,
  STROKE_WIDTHS,
  type Point,
  type Stroke,
} from "@/server/domain/sketch";

// Uneltele de desen din rail. „pen" freehand · forme cu 2 capete (line/rect/ellipse/arrow) · „text" casetă · „eraser".
type Tool = "pen" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";
const SHAPE_TOOLS = ["line", "rect", "ellipse", "arrow"] as const;
function isShapeTool(t: Tool | null): t is (typeof SHAPE_TOOLS)[number] {
  return t !== null && (SHAPE_TOOLS as readonly string[]).includes(t);
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

// Caseta unui stroke de text în PX pe canvas (ancoră + lățime/înălțime măsurate cu fontul real).
// Folosită pt hit-test (selecție/drag) și pt conturul de selecție. Rotația se aplică în jurul ancorei.
function measureTextBox(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const scale = width / REFERENCE_WIDTH;
  const fontPx = s.size * scale * TEXT_FONT_SCALE;
  ctx.font = `600 ${fontPx}px ${TEXT_FONT_FAMILY}`;
  const lines = (s.text ?? "").split("\n");
  const lineHeight = fontPx * 1.3;
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  return {
    x: (s.points[0]?.[0] ?? 0) * width,
    y: (s.points[0]?.[1] ?? 0) * height,
    w,
    h: lines.length * lineHeight,
  };
}

// Hit-test pe un text rotit: aducem punctul în spațiul ancorei + inverse-rotim, apoi verificăm caseta.
function textHit(ctx: CanvasRenderingContext2D, s: Stroke, px: number, py: number, w: number, h: number): boolean {
  const box = measureTextBox(ctx, s, w, h);
  const a = s.angle ?? 0;
  const dx = px - box.x;
  const dy = py - box.y;
  const rx = dx * Math.cos(-a) - dy * Math.sin(-a);
  const ry = dx * Math.sin(-a) + dy * Math.cos(-a);
  const pad = 6;
  return rx >= -pad && rx <= box.w + pad && ry >= -pad && ry <= box.h + pad;
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

// Intervalul sliderului de grosime (UI). Serverul validează independent 0 < size ≤ MAX_STROKE_SIZE.
const MIN_PEN_SIZE = 2;
const MAX_PEN_SIZE = 40;

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
    // Imaginea-mamă (schiță peste un detaliu). Absentă = mod „foaie goală" (creare detaliu prin desen).
    imageUrl?: string;
    // Raportul înălțime/lățime al foii goale (folosit doar când nu există imagine-mamă). Default 3/4 (4:3 orizontal).
    aspectRatio?: number;
    initialStrokes: Stroke[];
    onStrokesCount?: (count: number) => void;
  }
>(function SketchCanvas({ imageUrl, aspectRatio = 3 / 4, initialStrokes, onStrokesCount }, ref) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialStrokes,
    future: [],
  });
  const [color, setColor] = useState<string>(STROKE_COLORS[0]);
  const [size, setSize] = useState<number>(STROKE_WIDTHS[1]);
  // `null` = niciun tool selectat (mouse neutru — canvas-ul nu desenează). Stare în care intri
  // automat după ce fixezi un text: vrei să revii la cursor, nu să rămâi pe o unealtă de desen.
  const [tool, setTool] = useState<Tool | null>("pen");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  // Caseta de text în curs de tastare (poziție normalizată 0..1 + valoare + unghi la editare). null = niciuna.
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string; angle?: number } | null>(null);
  // Indexul textului selectat (în `present`) pentru mutare/rotire/redimensionare. null = nimic selectat.
  const [selected, setSelected] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const drawingRef = useRef<{ drawing: boolean; points: number[][] }>({ drawing: false, points: [] });
  // Radieră: setul de stroke-uri șterse într-o singură tragere (un singur pas de undo la final).
  const eraseRef = useRef<{ base: Stroke[]; removed: Set<number> } | null>(null);
  // Mutarea textului selectat prin drag: ancora originală + flag „chiar s-a mutat" + previzualizarea live.
  const dragRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const moveLiveRef = useRef<Stroke[] | null>(null);
  // Pinch-to-zoom (mobil/tabletă): pointerele touch active + ancora pinch-ului (distanța + zoom-ul de start).
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const present = history.present;

  // Expune strokes + export thumbnail pentru butoanele din bara de context.
  useImperativeHandle(
    ref,
    () => ({
      getStrokes: () => present,
      exportThumbnail: async () => {
        const img = imgRef.current;
        const w = REFERENCE_WIDTH;
        // Foaie goală: dims din aspectRatio + fundal alb solid. Cu imagine-mamă: raportul ei + fill slab 0.3.
        const h = img ? Math.round(w * (img.naturalHeight / img.naturalWidth)) : Math.round(w * aspectRatio);
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        if (img) {
          ctx.globalAlpha = 0.3;
          ctx.drawImage(img, 0, 0, w, h);
          ctx.globalAlpha = 1;
        }
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
    [present, aspectRatio],
  );

  useEffect(() => {
    onStrokesCount?.(present.length);
  }, [present.length, onStrokesCount]);

  // Dimensionare fit-to-area (păstrează raportul). Cu imagine-mamă: raportul ei; foaie goală: aspectRatio.
  useEffect(() => {
    let observer: ResizeObserver | null = null;
    // Raportul înălțime/lățime folosit la fit — setat din imagine (la onload) sau din aspectRatio (foaie goală).
    let ratio = aspectRatio;
    const fit = () => {
      const c = containerRef.current;
      if (!c) return;
      const availW = c.clientWidth - FIT_PADDING * 2;
      const availH = c.clientHeight - FIT_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;
      let w = availW;
      let h = w * ratio;
      if (h > availH) {
        h = availH;
        w = h / ratio;
      }
      setDims({ w: Math.round(w), h: Math.round(h) });
    };

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous"; // pt export fără taint
      img.onload = () => {
        imgRef.current = img;
        ratio = img.naturalHeight / img.naturalWidth;
        fit();
        observer = new ResizeObserver(fit);
        if (containerRef.current) observer.observe(containerRef.current);
      };
      // Imaginea-mamă poate eșua la încărcare (blob șters, CORS, outage rețea) — fără fallback, `dims`
      // rămâne 0x0 permanent și editorul devine inutilizabil. Degradăm la foaie goală (aspectRatio).
      img.onerror = () => {
        imgRef.current = null;
        ratio = aspectRatio;
        fit();
        observer = new ResizeObserver(fit);
        if (containerRef.current) observer.observe(containerRef.current);
      };
      img.src = imageUrl;
    } else {
      imgRef.current = null;
      fit();
      observer = new ResizeObserver(fit);
      if (containerRef.current) observer.observe(containerRef.current);
    }
    return () => observer?.disconnect();
  }, [imageUrl, aspectRatio]);

  // Redesenează: imaginea-mamă estompată (fill slab 0.3) + stroke-urile + stroke-ul în lucru.
  const redraw = useCallback((strokes: Stroke[], temp?: Stroke, selIndex?: number | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Foaie goală (fără imagine-mamă): fundal alb solid ca desenul să nu fie transparent. Grila NU intră în thumbnail.
    if (!imgRef.current) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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

    // Contur de selecție pentru textul ales (casetă punctată, rotită ca textul).
    if (selIndex != null) {
      const s = strokes[selIndex];
      if (s && s.kind === "text") {
        const box = measureTextBox(ctx, s, canvas.width, canvas.height);
        const pad = 5;
        ctx.save();
        ctx.translate(box.x, box.y);
        ctx.rotate(s.angle ?? 0);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "rgba(33,29,24,0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-pad, -pad, box.w + pad * 2, box.h + pad * 2);
        ctx.restore();
        ctx.setLineDash([]);
      }
    }
  }, []);

  // Zoom cu rotița mouse-ului, direct (fără Ctrl/Cmd) — editorul e full-screen (fixed inset-0), nu există
  // pagină dedesubt de scrollat, deci nu se pierde nimic (2026-07-06, decizie Liviu). Listener non-passive
  // ca să putem preveni scroll-ul (irelevant aici, dar consistent cu restul paginii dacă ea totuși scrollează).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  // Conturul de selecție apare în modul de selecție (mouse neutru sau tool Text), când nu tastezi.
  const selForDraw = (tool === null || tool === "text") && !textDraft ? selected : null;
  useEffect(() => {
    redraw(present, undefined, selForDraw);
  }, [dims, present, redraw, selForDraw]);

  // Schimbă unealta (sau o deselectează cu `null` = mouse neutru) + deselectează textul când ieși din modul text.
  const selectTool = useCallback((t: Tool | null) => {
    setTool(t);
    if (t !== "text") setSelected(null);
  }, []);

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
        ...(textDraft.angle ? { angle: textDraft.angle } : {}),
      };
      dispatch({ type: "commit", present: [...present, stroke] });
    }
    setTextDraft(null);
  }

  // Aplică o transformare pe textul selectat și o comite (un pas de undo).
  function updateSelectedText(fn: (s: Stroke) => Stroke) {
    if (selected === null) return;
    dispatch({ type: "commit", present: present.map((s, i) => (i === selected ? fn(s) : s)) });
  }

  // Reintră în editarea textului selectat (păstrează culoarea/mărimea/unghiul); scoate stroke-ul vechi.
  function editSelectedText() {
    if (selected === null) return;
    const s = present[selected];
    if (!s || s.kind !== "text") return;
    setColor(s.color);
    setSize(s.size);
    setTextDraft({ x: s.points[0][0], y: s.points[0][1], value: s.text ?? "", angle: s.angle });
    dispatch({ type: "commit", present: present.filter((_, i) => i !== selected) });
    setSelected(null);
  }

  function deleteSelectedText() {
    if (selected === null) return;
    dispatch({ type: "commit", present: present.filter((_, i) => i !== selected) });
    setSelected(null);
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

  // La al doilea deget pe foaie: intră în pinch-to-zoom — anulează orice desen/mutare în curs și
  // memorează distanța dintre degete + zoom-ul curent ca ancoră.
  function beginPinch() {
    drawingRef.current = { drawing: false, points: [] };
    eraseRef.current = null;
    dragRef.current = null;
    moveLiveRef.current = null;
    redraw(present); // șterge preview-ul live al stroke-ului abandonat
    const pts = [...pointersRef.current.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    pinchRef.current = { startDist: dist, startZoom: zoom };
  }

  function onPointerDown(e: React.PointerEvent) {
    // Touch: urmărește degetele active. Al doilea deget → pinch-zoom (nu desen).
    if (e.pointerType === "touch") {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        beginPinch();
        return;
      }
    }
    const p = normPoint(e);
    // Mouse neutru (tool null) SAU tool Text = mod de SELECȚIE: poți prinde/muta un text existent
    // și apare bara de editare (poziție/mărime/editare). Diferența: doar tool-ul Text deschide o casetă
    // nouă la click pe gol; în neutru, click pe gol doar deselectează.
    if (tool === null || tool === "text") {
      // Tastezi deja o casetă → orice click o fixează și deselectează tool-ul (mouse neutru).
      if (textDraft) {
        commitText();
        selectTool(null);
        return;
      }
      // Click pe un text existent → selectează-l + pregătește mutarea prin drag.
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        for (let i = present.length - 1; i >= 0; i--) {
          const s = present[i];
          if (s.kind === "text" && textHit(ctx, s, p[0] * dims.w, p[1] * dims.h, dims.w, dims.h)) {
            setSelected(i);
            dragRef.current = {
              index: i,
              startX: p[0],
              startY: p[1],
              origX: s.points[0][0],
              origY: s.points[0][1],
              moved: false,
            };
            canvasRef.current?.setPointerCapture(e.pointerId);
            return;
          }
        }
      }
      // Click pe gol: tool Text → deschide o casetă nouă; neutru → doar deselectează.
      setSelected(null);
      if (tool === "text") setTextDraft({ x: p[0], y: p[1], value: "" });
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
    // Pinch-zoom activ: actualizează poziția degetului + ajustează zoom-ul după raportul distanțelor.
    if (pinchRef.current && e.pointerType === "touch") {
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      const pts = [...pointersRef.current.values()];
      if (pts.length >= 2 && pinchRef.current.startDist > 0) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        setZoom(clampZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
      }
      return;
    }
    // Mutarea textului selectat (drag) — independentă de desen.
    if (dragRef.current) {
      const d = dragRef.current;
      const p = normPoint(e);
      const nx = Math.min(1, Math.max(0, d.origX + (p[0] - d.startX)));
      const ny = Math.min(1, Math.max(0, d.origY + (p[1] - d.startY)));
      if (Math.abs(p[0] - d.startX) > 0.002 || Math.abs(p[1] - d.startY) > 0.002) d.moved = true;
      const next = present.map((s, i) =>
        i === d.index ? { ...s, points: [[nx, ny]] as Point[] } : s,
      );
      moveLiveRef.current = next;
      redraw(next, undefined, d.index);
      return;
    }
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

  function onPointerUp(e?: React.PointerEvent) {
    // Touch: scoate degetul ridicat. Dacă eram în pinch și au rămas <2 degete → ieși din pinch.
    // În orice caz, cât timp pinch-ul e (sau a fost) activ nu comitem niciun stroke.
    if (e?.pointerType === "touch") pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    // Finalizează mutarea textului: comite doar dacă s-a mutat efectiv.
    if (dragRef.current) {
      const d = dragRef.current;
      dragRef.current = null;
      if (d.moved && moveLiveRef.current) {
        dispatch({ type: "commit", present: moveLiveRef.current });
      }
      moveLiveRef.current = null;
      return;
    }
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
      <aside className="z-10 flex w-[86px] flex-none flex-col items-center gap-3.5 overflow-y-auto border-r border-border bg-background py-4">
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
                onClick={() => selectTool(value)}
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
                "size-6 rounded-full ring-offset-background transition-shadow",
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
          className="flex w-full flex-col items-center gap-3 transition-opacity"
          style={{ opacity: drawActive ? 1 : 0.5 }}
        >
          {/* Punct de previzualizare a grosimii curente (scalat pentru rail, nu afectează desenul). */}
          <span
            aria-hidden
            className="block rounded-full"
            style={{
              width: 4 + Math.round(((size - MIN_PEN_SIZE) / (MAX_PEN_SIZE - MIN_PEN_SIZE)) * 18),
              height: 4 + Math.round(((size - MIN_PEN_SIZE) / (MAX_PEN_SIZE - MIN_PEN_SIZE)) * 18),
              backgroundColor: drawActive ? color : "var(--muted-foreground)",
            }}
          />
          <input
            type="range"
            min={MIN_PEN_SIZE}
            max={MAX_PEN_SIZE}
            step={1}
            value={Math.min(MAX_PEN_SIZE, Math.max(MIN_PEN_SIZE, size))}
            aria-label="Grosimea creionului"
            onChange={(e) => {
              setSize(Number(e.target.value));
              if (tool === "eraser") setTool("pen");
            }}
            className="h-[120px] cursor-pointer [accent-color:var(--primary)]"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
        </div>

        <RailDivider />

        <button
          type="button"
          aria-label="Radieră"
          aria-pressed={tool === "eraser"}
          onClick={() => selectTool(tool === "eraser" ? "pen" : "eraser")}
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
        <span className="pointer-events-none absolute left-[18px] top-4 z-[6] inline-flex items-center gap-1.5 rounded-[7px] border border-[#e6dccd] bg-white/80 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide text-[#7c7060]">
          <span className="block size-[7px] rounded-full bg-primary" />
          {imageUrl ? "Mod schiță · detaliul-mamă estompat" : "Mod desen · foaie nouă"}
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

        {/* Wrapper la dimensiunea exactă a foii (scalat de zoom) → ancorează input-ul flotant de text. */}
        <div
          className="relative z-[4]"
          style={{
            width: dims.w,
            height: dims.h,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "center center",
          }}
        >
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
              cursor: !tool
                ? "default"
                : tool === "eraser"
                  ? "cell"
                  : tool === "text"
                    ? "text"
                    : "crosshair",
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
                  selectTool(null); // după un comentariu → mouse neutru (deselectează tool-ul)
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextDraft(null);
                  selectTool(null);
                }
              }}
              onBlur={() => {
                commitText();
                selectTool(null);
              }}
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

          {/* Bara de control a textului selectat: rotire, mărime, editare, ștergere. Ancorată deasupra textului. */}
          {selected !== null && !textDraft && present[selected]?.kind === "text" && (
            <div
              className="absolute z-[7] flex -translate-y-full items-center gap-0.5 rounded-lg border border-[#e6dccd] bg-white/95 p-1 shadow-md"
              style={{
                left: (present[selected].points[0]?.[0] ?? 0) * dims.w,
                top: (present[selected].points[0]?.[1] ?? 0) * dims.h - 8,
              }}
              // Nu lăsa click-urile pe bară să ajungă la canvas (ar deselecta / crea text).
              onPointerDown={(e) => e.stopPropagation()}
            >
              <TextCtrlBtn label="Rotește stânga" onClick={() => updateSelectedText((s) => ({ ...s, angle: (s.angle ?? 0) - Math.PI / 12 }))}>
                <RotateCcw className="size-4" strokeWidth={2} />
              </TextCtrlBtn>
              <TextCtrlBtn label="Rotește dreapta" onClick={() => updateSelectedText((s) => ({ ...s, angle: (s.angle ?? 0) + Math.PI / 12 }))}>
                <RotateCw className="size-4" strokeWidth={2} />
              </TextCtrlBtn>
              <span className="mx-0.5 h-5 w-px bg-[#e6dccd]" />
              <TextCtrlBtn label="Micșorează" onClick={() => updateSelectedText((s) => ({ ...s, size: Math.max(4, s.size / 1.2) }))}>
                <Minus className="size-4" strokeWidth={2} />
              </TextCtrlBtn>
              <TextCtrlBtn label="Mărește" onClick={() => updateSelectedText((s) => ({ ...s, size: Math.min(MAX_STROKE_SIZE, s.size * 1.2) }))}>
                <Plus className="size-4" strokeWidth={2} />
              </TextCtrlBtn>
              <span className="mx-0.5 h-5 w-px bg-[#e6dccd]" />
              <TextCtrlBtn label="Editează textul" onClick={editSelectedText}>
                <Pencil className="size-4" strokeWidth={2} />
              </TextCtrlBtn>
              <TextCtrlBtn label="Șterge" onClick={deleteSelectedText}>
                <Trash2 className="size-4 text-destructive" strokeWidth={2} />
              </TextCtrlBtn>
            </div>
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

// Buton din bara de control a textului selectat (rotire/mărime/editare/ștergere).
function TextCtrlBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  );
}
