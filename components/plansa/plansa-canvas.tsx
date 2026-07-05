"use client";

// Engine-ul Planșei v2 — canvas PROPRIU (nu Excalidraw/tldraw), construit pe modelul SketchCanvas:
// zonă de lucru FIXĂ 16:10 (nu canvas infinit) cu pan/zoom liber, imagini-detaliu poziționabile
// (mută/scalează din colțuri cu aspect blocat/z-order — fără rotație în v1, fără multi-select) +
// un strat global de desen freehand peste ansamblu (motorul de la Schiță: perfect-freehand prin
// renderStrokes, coordonate normalizate 0..1, aceleași unelte/culori/grosimi).
//
// Uneltele de desen sunt duplicate pragmatic din sketch-canvas.tsx (decizie de plan: extragerea
// într-un hook comun e refactor ulterior, după ce ambele UI-uri sunt stabile).

import {
  ArrowUpRight,
  BringToFront,
  Circle,
  Eraser,
  ExternalLink,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  SendToBack,
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
  REFERENCE_WIDTH,
  renderStrokes,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SCALE,
} from "@/lib/sketch-render";
import { cn } from "@/lib/utils";
import {
  MAX_ITEM_SIZE,
  MIN_ITEM_SIZE,
  type CanvasDocument,
  type CanvasItem,
} from "@/server/domain/plansa";
import {
  MAX_STROKE_SIZE,
  MAX_TEXT_LENGTH,
  STROKE_COLORS,
  STROKE_WIDTHS,
  type Point,
  type Stroke,
} from "@/server/domain/sketch";

// Raportul zonei de lucru (16:10) — spațiul logic de referință al coordonatelor normalizate.
export const WORKSPACE_RATIO = 10 / 16;
// Rezoluția thumbnail-ului exportat (aceeași rație).
const THUMB_W = 800;
const THUMB_H = Math.round(THUMB_W * WORKSPACE_RATIO);

// „select" = mouse neutru (selectezi/muți/scalezi imagini, faci pan pe gol); restul = unelte de desen.
type Tool = "select" | "pen" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";
const SHAPE_TOOLS = ["line", "rect", "ellipse", "arrow"] as const;
function isShapeTool(t: Tool): t is (typeof SHAPE_TOOLS)[number] {
  return (SHAPE_TOOLS as readonly string[]).includes(t);
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

const TOOL_ITEMS: { value: Tool; label: string; Icon: typeof Pencil }[] = [
  { value: "select", label: "Selectează / mută", Icon: MousePointer2 },
  { value: "pen", label: "Creion", Icon: Pencil },
  { value: "line", label: "Linie dreaptă", Icon: Slash },
  { value: "rect", label: "Dreptunghi", Icon: Square },
  { value: "ellipse", label: "Cerc", Icon: Circle },
  { value: "arrow", label: "Săgeată", Icon: ArrowUpRight },
  { value: "text", label: "Text", Icon: Type },
];

// ── Hit-test radieră (identic cu sketch-canvas) ─────────────────────────────────────────────────
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
  if (pts.length === 1) return Math.hypot(px - a[0], py - a[1]) <= th;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointSegDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= th) return true;
  }
  return false;
}

// Caseta unui text în PX (identic cu sketch-canvas).
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

// ── Istoric UNIFICAT (undo/redo) — items + strokes într-un singur snapshot ──────────────────────
type Snapshot = { items: CanvasItem[]; strokes: Stroke[] };
type History = { past: Snapshot[]; present: Snapshot; future: Snapshot[] };
type HistoryAction =
  | { type: "commit"; present: Snapshot }
  // Corecție tehnică FĂRĂ pas de istorie: fixează raportul real al imaginii pe un item nou-materializat.
  | { type: "fixAspect"; detailId: string; ratio: number }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "commit":
      return { past: [...state.past, state.present], present: action.present, future: [] };
    case "fixAspect":
      return {
        ...state,
        present: {
          ...state.present,
          items: state.present.items.map((it) =>
            it.detailId === action.detailId
              ? { ...it, height: clampItemSize(it.width * action.ratio * (1 / WORKSPACE_RATIO)) }
              : it,
          ),
        },
      };
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

const ERASE_THRESHOLD = 0.025;
const FIT_PADDING = 28;
const MIN_PEN_SIZE = 2;
const MAX_PEN_SIZE = 40;

// Lățimea implicită (normalizată) a unui item nou-materializat; înălțimea se corectează la load
// după raportul real al imaginii.
const DEFAULT_ITEM_W = 0.28;

// Detaliu accesibil (din service): datele de randare pentru un item.
export type PlansaItemSource = { detailId: string; imageUrl: string; title: string };

export type PlansaCanvasHandle = {
  getDocument: () => CanvasDocument;
  exportThumbnail: () => Promise<Blob | null>;
};

// Reconciliere la mount (index canvas_items ↔ geometria din document):
//  - detalii din index fără item în document → materializate în cascadă (poziții decalate);
//  - items al căror detaliu nu mai e accesibil → păstrate (randate ca placeholder „Detaliu indisponibil").
function buildInitialSnapshot(doc: CanvasDocument | null, sources: PlansaItemSource[]): {
  snapshot: Snapshot;
  materialized: Set<string>;
} {
  const items = [...(doc?.items ?? [])];
  const strokes = doc?.strokes ?? [];
  const materialized = new Set<string>();
  const present = new Set(items.map((it) => it.detailId));
  let z = items.reduce((m, it) => Math.max(m, it.z), 0);
  let cascade = 0;
  for (const src of sources) {
    if (present.has(src.detailId)) continue;
    z += 1;
    items.push({
      id: crypto.randomUUID(),
      detailId: src.detailId,
      x: 0.08 + (cascade % 6) * 0.05,
      y: 0.08 + (cascade % 6) * 0.06,
      width: DEFAULT_ITEM_W,
      // Înălțime provizorie (4:3) — corectată la load-ul imaginii (raportul real), fără pas de istorie.
      height: DEFAULT_ITEM_W * 0.75 * (1 / WORKSPACE_RATIO),
      z,
    });
    materialized.add(src.detailId);
    cascade++;
  }
  return { snapshot: { items, strokes }, materialized };
}

export const PlansaCanvas = forwardRef<
  PlansaCanvasHandle,
  {
    initialDocument: CanvasDocument | null;
    // Detaliile încă accesibile (index ∩ PUBLISHED) — sursa imaginilor. Ce nu e aici → placeholder.
    sources: PlansaItemSource[];
    // Notifică orice modificare de document (shell-ul face autosave debounced).
    onChange?: (doc: CanvasDocument) => void;
    // Eliminarea unui detaliu de pe planșă (shell-ul cheamă server action-ul de index).
    onRemoveItem?: (detailId: string) => void;
  }
>(function PlansaCanvas({ initialDocument, sources, onChange, onRemoveItem }, ref) {
  const [history, dispatch] = useReducer(
    historyReducer,
    null,
    (): History => {
      const { snapshot } = buildInitialSnapshot(initialDocument, sources);
      return { past: [], present: snapshot, future: [] };
    },
  );
  const [color, setColor] = useState<string>(STROKE_COLORS[0]);
  const [size, setSize] = useState<number>(STROKE_WIDTHS[1]);
  const [tool, setTool] = useState<Tool>("select");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string; angle?: number } | null>(null);
  // Selecția curentă: un item (imagine) SAU un stroke de text. null = nimic.
  const [selection, setSelection] = useState<
    | { kind: "item"; id: string }
    | { kind: "text"; index: number }
    | null
  >(null);
  // Bump la fiecare imagine încărcată → re-render/redraw.
  const [imgVersion, setImgVersion] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map()); // detailId → imagine încărcată
  const failedRef = useRef<Set<string>>(new Set()); // imagini eșuate → placeholder
  // Items materializate la mount cu înălțime provizorie — corectate la load (fără pas de istorie).
  const pendingAspectRef = useRef<Set<string>>(new Set());
  const drawingRef = useRef<{ drawing: boolean; points: number[][] }>({ drawing: false, points: [] });
  const eraseRef = useRef<{ base: Stroke[]; removed: Set<number> } | null>(null);
  const textDragRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const itemDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{
    id: string;
    anchorX: number;
    anchorY: number;
    origW: number;
    origH: number;
    left: boolean; // colțul tras e la stânga ancorei
    top: boolean; //  … deasupra ancorei
  } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const liveRef = useRef<Snapshot | null>(null); // previzualizare drag/resize (comisă la pointer up)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const skipFirstChangeRef = useRef(true);

  const present = history.present;

  // La mount: reține care items au fost materializate acum (aspect de corectat la load).
  useEffect(() => {
    const { materialized } = buildInitialSnapshot(initialDocument, sources);
    pendingAspectRef.current = materialized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toDocument = useCallback(
    (snap: Snapshot): CanvasDocument => ({ version: 1, items: snap.items, strokes: snap.strokes }),
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      getDocument: () => toDocument(present),
      exportThumbnail: async () => {
        const off = document.createElement("canvas");
        off.width = THUMB_W;
        off.height = THUMB_H;
        const ctx = off.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, THUMB_W, THUMB_H);
        drawItems(ctx, present.items, THUMB_W, THUMB_H, imagesRef.current, null);
        renderStrokes(ctx, present.strokes, THUMB_W, THUMB_H);
        return new Promise((resolve) => {
          try {
            off.toBlob((b) => resolve(b), "image/png");
          } catch {
            resolve(null);
          }
        });
      },
    }),
    [present, toDocument],
  );

  // Notifică shell-ul la fiecare modificare comisă (autosave debounced acolo). Sare peste mount.
  useEffect(() => {
    if (skipFirstChangeRef.current) {
      skipFirstChangeRef.current = false;
      return;
    }
    onChange?.(toDocument(present));
  }, [present, onChange, toDocument]);

  // Încarcă imaginile detaliilor accesibile; la load corectează aspectul items-elor noi-materializate.
  useEffect(() => {
    for (const src of sources) {
      if (imagesRef.current.has(src.detailId) || failedRef.current.has(src.detailId)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous"; // pt export fără taint
      img.onload = () => {
        imagesRef.current.set(src.detailId, img);
        if (pendingAspectRef.current.has(src.detailId)) {
          pendingAspectRef.current.delete(src.detailId);
          // hNorm = wNorm * (natH/natW) * (W/H al zonei) — păstrează raportul real al imaginii.
          dispatch({ type: "fixAspect", detailId: src.detailId, ratio: img.naturalHeight / img.naturalWidth });
        }
        setImgVersion((v) => v + 1);
      };
      img.onerror = () => {
        failedRef.current.add(src.detailId);
        setImgVersion((v) => v + 1);
      };
      img.src = src.imageUrl;
    }
  }, [sources]);

  // Dimensionare fit-to-area (raport fix 16:10).
  useEffect(() => {
    const fit = () => {
      const c = containerRef.current;
      if (!c) return;
      const availW = c.clientWidth - FIT_PADDING * 2;
      const availH = c.clientHeight - FIT_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;
      let w = availW;
      let h = w * WORKSPACE_RATIO;
      if (h > availH) {
        h = availH;
        w = h / WORKSPACE_RATIO;
      }
      setDims({ w: Math.round(w), h: Math.round(h) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Redesenare ─────────────────────────────────────────────────────────────
  const redraw = useCallback(
    (snap: Snapshot, temp?: Stroke, sel?: typeof selection) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Grilă (nu intră în thumbnail — exportul desenează separat, fără grilă).
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

      const selectedItemId = sel?.kind === "item" ? sel.id : null;
      drawItems(ctx, snap.items, canvas.width, canvas.height, imagesRef.current, selectedItemId);
      renderStrokes(ctx, snap.strokes, canvas.width, canvas.height);
      if (temp) renderStrokes(ctx, [temp], canvas.width, canvas.height);

      // Contur de selecție pentru text (identic cu sketch-canvas).
      if (sel?.kind === "text") {
        const s = snap.strokes[sel.index];
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
    },
    [],
  );

  // Zoom cu Ctrl/Cmd + rotița (non-passive, previne scroll-ul paginii).
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

  const selForDraw = (tool === "select" || tool === "text") && !textDraft ? selection : null;
  useEffect(() => {
    redraw(present, undefined, selForDraw);
  }, [dims, present, redraw, selForDraw, imgVersion]);

  const selectTool = useCallback((t: Tool) => {
    setTool(t);
    if (t !== "text" && t !== "select") setSelection(null);
  }, []);

  // ── Interacțiune ───────────────────────────────────────────────────────────
  function normPoint(e: React.PointerEvent): number[] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [x, y];
  }
  const clampNorm = (n: number) => Math.min(1, Math.max(0, n));

  function makeStroke(points: number[][], kind: Stroke["kind"]): Stroke {
    return { color, size, kind, points: points.map(([x, y]) => [x, y]) };
  }

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
      dispatch({ type: "commit", present: { ...present, strokes: [...present.strokes, stroke] } });
    }
    setTextDraft(null);
  }

  function updateSelectedText(fn: (s: Stroke) => Stroke) {
    if (selection?.kind !== "text") return;
    const idx = selection.index;
    dispatch({
      type: "commit",
      present: { ...present, strokes: present.strokes.map((s, i) => (i === idx ? fn(s) : s)) },
    });
  }

  function editSelectedText() {
    if (selection?.kind !== "text") return;
    const s = present.strokes[selection.index];
    if (!s || s.kind !== "text") return;
    setColor(s.color);
    setSize(s.size);
    setTextDraft({ x: s.points[0][0], y: s.points[0][1], value: s.text ?? "", angle: s.angle });
    dispatch({
      type: "commit",
      present: { ...present, strokes: present.strokes.filter((_, i) => i !== selection.index) },
    });
    setSelection(null);
  }

  function deleteSelectedText() {
    if (selection?.kind !== "text") return;
    dispatch({
      type: "commit",
      present: { ...present, strokes: present.strokes.filter((_, i) => i !== selection.index) },
    });
    setSelection(null);
  }

  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  function applyErase(p: number[]) {
    const er = eraseRef.current;
    if (!er) return;
    for (let i = 0; i < er.base.length; i++) {
      if (!er.removed.has(i) && strokeHit(er.base[i], p[0], p[1], ERASE_THRESHOLD)) {
        er.removed.add(i);
      }
    }
    redraw({ ...present, strokes: er.base.filter((_, i) => !er.removed.has(i)) });
  }

  function beginPinch() {
    drawingRef.current = { drawing: false, points: [] };
    eraseRef.current = null;
    textDragRef.current = null;
    itemDragRef.current = null;
    resizeRef.current = null;
    panRef.current = null;
    liveRef.current = null;
    redraw(present);
    const pts = [...pointersRef.current.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    pinchRef.current = { startDist: dist, startZoom: zoom };
  }

  const selectedItem =
    selection?.kind === "item" ? present.items.find((it) => it.id === selection.id) ?? null : null;

  // Hit-test pe handle-urile de colț ale item-ului selectat (prag în px ecran → normalizat).
  function hitHandle(p: number[]): { left: boolean; top: boolean } | null {
    if (!selectedItem || dims.w === 0) return null;
    const thx = 10 / (dims.w * zoom);
    const thy = 10 / (dims.h * zoom);
    const corners = [
      { x: selectedItem.x, y: selectedItem.y, left: true, top: true },
      { x: selectedItem.x + selectedItem.width, y: selectedItem.y, left: false, top: true },
      { x: selectedItem.x, y: selectedItem.y + selectedItem.height, left: true, top: false },
      { x: selectedItem.x + selectedItem.width, y: selectedItem.y + selectedItem.height, left: false, top: false },
    ];
    for (const c of corners) {
      if (Math.abs(p[0] - c.x) <= thx && Math.abs(p[1] - c.y) <= thy) {
        return { left: c.left, top: c.top };
      }
    }
    return null;
  }

  function hitItem(p: number[]): CanvasItem | null {
    const sorted = [...present.items].sort((a, b) => b.z - a.z);
    for (const it of sorted) {
      if (p[0] >= it.x && p[0] <= it.x + it.width && p[1] >= it.y && p[1] <= it.y + it.height) {
        return it;
      }
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        beginPinch();
        return;
      }
    }
    const p = normPoint(e);

    if (tool === "select" || tool === "text") {
      if (textDraft) {
        commitText();
        selectTool("select");
        return;
      }
      const ctx = canvasRef.current?.getContext("2d");
      // 1) Text existent (stratul de adnotare e deasupra imaginilor).
      if (ctx) {
        for (let i = present.strokes.length - 1; i >= 0; i--) {
          const s = present.strokes[i];
          if (s.kind === "text" && textHit(ctx, s, p[0] * dims.w, p[1] * dims.h, dims.w, dims.h)) {
            setSelection({ kind: "text", index: i });
            textDragRef.current = {
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
      if (tool === "select") {
        // 2) Handle de resize pe item-ul selectat.
        const handle = hitHandle(p);
        if (handle && selectedItem) {
          const anchorX = handle.left ? selectedItem.x + selectedItem.width : selectedItem.x;
          const anchorY = handle.top ? selectedItem.y + selectedItem.height : selectedItem.y;
          resizeRef.current = {
            id: selectedItem.id,
            anchorX,
            anchorY,
            origW: selectedItem.width,
            origH: selectedItem.height,
            left: handle.left,
            top: handle.top,
          };
          canvasRef.current?.setPointerCapture(e.pointerId);
          return;
        }
        // 3) Item (imagine) — selectează + pregătește mutarea.
        const it = hitItem(p);
        if (it) {
          setSelection({ kind: "item", id: it.id });
          itemDragRef.current = {
            id: it.id,
            startX: p[0],
            startY: p[1],
            origX: it.x,
            origY: it.y,
            moved: false,
          };
          canvasRef.current?.setPointerCapture(e.pointerId);
          return;
        }
        // 4) Gol → pan (deselectează la release fără mișcare).
        panRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, moved: false };
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      // tool === "text": click pe gol → casetă nouă.
      setSelection(null);
      setTextDraft({ x: clampNorm(p[0]), y: clampNorm(p[1]), value: "" });
      return;
    }

    canvasRef.current?.setPointerCapture(e.pointerId);
    const pc = [clampNorm(p[0]), clampNorm(p[1])];
    if (tool === "eraser") {
      drawingRef.current = { drawing: true, points: [] };
      eraseRef.current = { base: present.strokes, removed: new Set() };
      applyErase(pc);
      return;
    }
    if (isShapeTool(tool)) {
      drawingRef.current = { drawing: true, points: [pc, pc] };
      redraw(present, makeStroke([pc, pc], tool));
      return;
    }
    drawingRef.current = { drawing: true, points: [pc] };
    redraw(present, makeStroke([pc], "free"));
  }

  function onPointerMove(e: React.PointerEvent) {
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
    // Pan pe fundal gol.
    if (panRef.current) {
      const d = panRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setPan({ x: d.origX + dx, y: d.origY + dy });
      return;
    }
    // Resize item (aspect blocat, ancoră = colțul opus).
    if (resizeRef.current) {
      const r = resizeRef.current;
      const p = normPoint(e);
      const dx = Math.abs(p[0] - r.anchorX);
      const dy = Math.abs(p[1] - r.anchorY);
      const scale = Math.max(dx / r.origW, dy / r.origH, 0.01);
      const newW = clampItemSize(r.origW * scale);
      const newH = r.origH * (newW / r.origW);
      const next: Snapshot = {
        ...present,
        items: present.items.map((it) =>
          it.id === r.id
            ? {
                ...it,
                width: newW,
                height: newH,
                x: r.left ? r.anchorX - newW : r.anchorX,
                y: r.top ? r.anchorY - newH : r.anchorY,
              }
            : it,
        ),
      };
      liveRef.current = next;
      redraw(next, undefined, selection);
      return;
    }
    // Mutare item.
    if (itemDragRef.current) {
      const d = itemDragRef.current;
      const p = normPoint(e);
      const nx = Math.min(1.9, Math.max(-0.9, d.origX + (p[0] - d.startX)));
      const ny = Math.min(1.9, Math.max(-0.9, d.origY + (p[1] - d.startY)));
      if (Math.abs(p[0] - d.startX) > 0.002 || Math.abs(p[1] - d.startY) > 0.002) d.moved = true;
      const next: Snapshot = {
        ...present,
        items: present.items.map((it) => (it.id === d.id ? { ...it, x: nx, y: ny } : it)),
      };
      liveRef.current = next;
      redraw(next, undefined, selection);
      return;
    }
    // Mutare text (identic cu sketch-canvas).
    if (textDragRef.current) {
      const d = textDragRef.current;
      const p = normPoint(e);
      const nx = clampNorm(d.origX + (p[0] - d.startX));
      const ny = clampNorm(d.origY + (p[1] - d.startY));
      if (Math.abs(p[0] - d.startX) > 0.002 || Math.abs(p[1] - d.startY) > 0.002) d.moved = true;
      const next: Snapshot = {
        ...present,
        strokes: present.strokes.map((s, i) =>
          i === d.index ? { ...s, points: [[nx, ny]] as Point[] } : s,
        ),
      };
      liveRef.current = next;
      redraw(next, undefined, selection);
      return;
    }
    if (!drawingRef.current.drawing) return;
    const p = normPoint(e);
    const pc = [clampNorm(p[0]), clampNorm(p[1])];
    if (tool === "eraser") {
      applyErase(pc);
      return;
    }
    if (isShapeTool(tool)) {
      drawingRef.current.points = [drawingRef.current.points[0], pc];
      redraw(present, makeStroke(drawingRef.current.points, tool));
      return;
    }
    drawingRef.current.points.push(pc);
    redraw(present, makeStroke(drawingRef.current.points, "free"));
  }

  function onPointerUp(e?: React.PointerEvent) {
    if (e?.pointerType === "touch") pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    if (panRef.current) {
      const wasMoved = panRef.current.moved;
      panRef.current = null;
      if (!wasMoved) setSelection(null); // click pe gol fără tragere → deselectează
      return;
    }
    if (resizeRef.current) {
      resizeRef.current = null;
      if (liveRef.current) dispatch({ type: "commit", present: liveRef.current });
      liveRef.current = null;
      return;
    }
    if (itemDragRef.current) {
      const d = itemDragRef.current;
      itemDragRef.current = null;
      if (d.moved && liveRef.current) dispatch({ type: "commit", present: liveRef.current });
      liveRef.current = null;
      return;
    }
    if (textDragRef.current) {
      const d = textDragRef.current;
      textDragRef.current = null;
      if (d.moved && liveRef.current) dispatch({ type: "commit", present: liveRef.current });
      liveRef.current = null;
      return;
    }
    const { drawing, points } = drawingRef.current;
    drawingRef.current = { drawing: false, points: [] };
    if (tool === "eraser") {
      const er = eraseRef.current;
      eraseRef.current = null;
      if (er && er.removed.size > 0) {
        dispatch({
          type: "commit",
          present: { ...present, strokes: er.base.filter((_, i) => !er.removed.has(i)) },
        });
      }
      return;
    }
    if (!drawing || points.length === 0) return;
    if (isShapeTool(tool)) {
      const start = points[0];
      const end = points[points.length - 1];
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.005) return;
      dispatch({
        type: "commit",
        present: { ...present, strokes: [...present.strokes, makeStroke([start, end], tool)] },
      });
      return;
    }
    dispatch({
      type: "commit",
      present: { ...present, strokes: [...present.strokes, makeStroke(points, "free")] },
    });
  }

  // ── Acțiuni pe item-ul selectat ────────────────────────────────────────────
  function bringToFront() {
    if (!selectedItem) return;
    const maxZ = present.items.reduce((m, it) => Math.max(m, it.z), 0);
    if (selectedItem.z === maxZ) return;
    dispatch({
      type: "commit",
      present: {
        ...present,
        items: present.items.map((it) => (it.id === selectedItem.id ? { ...it, z: maxZ + 1 } : it)),
      },
    });
  }

  function sendToBack() {
    if (!selectedItem) return;
    const minZ = present.items.reduce((m, it) => Math.min(m, it.z), 0);
    if (selectedItem.z === minZ) return;
    dispatch({
      type: "commit",
      present: {
        ...present,
        items: present.items.map((it) => (it.id === selectedItem.id ? { ...it, z: minZ - 1 } : it)),
      },
    });
  }

  function removeSelectedItem() {
    if (!selectedItem) return;
    const detailId = selectedItem.detailId;
    dispatch({
      type: "commit",
      present: { ...present, items: present.items.filter((it) => it.id !== selectedItem.id) },
    });
    setSelection(null);
    onRemoveItem?.(detailId);
  }

  const selectedSource = selectedItem
    ? sources.find((s) => s.detailId === selectedItem.detailId) ?? null
    : null;

  const drawActive = tool !== "eraser" && tool !== "select";
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
        <div className="grid grid-cols-2 gap-2.5 transition-opacity" style={{ opacity: drawActive ? 1 : 0.5 }}>
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Culoare ${c}`}
              onClick={() => {
                setColor(c);
                if (tool === "eraser" || tool === "select") setTool("pen");
              }}
              className={cn(
                "size-6 rounded-full ring-offset-[#faf8f4] transition-shadow",
                drawActive && color === c ? "ring-2 ring-foreground ring-offset-2" : "ring-1 ring-foreground/15",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <RailDivider />

        <RailLabel>Grosime</RailLabel>
        <div className="flex w-full flex-col items-center gap-3 transition-opacity" style={{ opacity: drawActive ? 1 : 0.5 }}>
          <span
            aria-hidden
            className="block rounded-full"
            style={{
              width: 4 + Math.round(((size - MIN_PEN_SIZE) / (MAX_PEN_SIZE - MIN_PEN_SIZE)) * 18),
              height: 4 + Math.round(((size - MIN_PEN_SIZE) / (MAX_PEN_SIZE - MIN_PEN_SIZE)) * 18),
              backgroundColor: drawActive ? color : "#8a8073",
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
              if (tool === "eraser" || tool === "select") setTool("pen");
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

      {/* ZONA DE LUCRU */}
      <div
        ref={containerRef}
        className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#efece6]"
      >
        <span className="pointer-events-none absolute left-[18px] top-4 z-[6] inline-flex items-center gap-1.5 rounded-[7px] border border-[#e6dccd] bg-white/80 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide text-[#7c7060]">
          <span className="block size-[7px] rounded-full bg-primary" />
          {tool === "select" ? "Mod aranjare · trage pe gol ca să te miști" : "Mod desen · peste ansamblu"}
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
            title="Resetează vederea"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
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

        {/* Wrapper la dimensiunea foii (pan + zoom prin transform). */}
        <div
          className="relative z-[4]"
          style={{
            width: dims.w,
            height: dims.h,
            transform: `translate(${pan.x}px, ${pan.y}px)${zoom !== 1 ? ` scale(${zoom})` : ""}`,
            transformOrigin: "center center",
          }}
        >
          <canvas
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="block touch-none rounded-lg bg-[#faf7f1] shadow-sm ring-1 ring-foreground/10"
            style={{
              width: dims.w,
              height: dims.h,
              cursor:
                tool === "select"
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
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                setTextDraft((d) => (d ? { ...d, value: e.target.value } : d));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                  selectTool("select");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextDraft(null);
                  selectTool("select");
                }
              }}
              onBlur={() => {
                commitText();
                selectTool("select");
              }}
              placeholder="scrie…"
              className="absolute z-[6] resize-none overflow-hidden whitespace-pre rounded-[2px] p-0 outline-none placeholder:text-foreground/25"
              style={{
                left: textDraft.x * dims.w,
                top: textDraft.y * dims.h,
                color,
                caretColor: color,
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

          {/* Bara textului selectat (identică cu sketch-canvas). */}
          {selection?.kind === "text" && !textDraft && present.strokes[selection.index]?.kind === "text" && (
            <div
              className="absolute z-[7] flex -translate-y-full items-center gap-0.5 rounded-lg border border-[#e6dccd] bg-white/95 p-1 shadow-md"
              style={{
                left: (present.strokes[selection.index].points[0]?.[0] ?? 0) * dims.w,
                top: (present.strokes[selection.index].points[0]?.[1] ?? 0) * dims.h - 8,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CtrlBtn label="Rotește stânga" onClick={() => updateSelectedText((s) => ({ ...s, angle: (s.angle ?? 0) - Math.PI / 12 }))}>
                <RotateCcw className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <CtrlBtn label="Rotește dreapta" onClick={() => updateSelectedText((s) => ({ ...s, angle: (s.angle ?? 0) + Math.PI / 12 }))}>
                <RotateCw className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <span className="mx-0.5 h-5 w-px bg-[#e6dccd]" />
              <CtrlBtn label="Micșorează" onClick={() => updateSelectedText((s) => ({ ...s, size: Math.max(4, s.size / 1.2) }))}>
                <Minus className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <CtrlBtn label="Mărește" onClick={() => updateSelectedText((s) => ({ ...s, size: Math.min(MAX_STROKE_SIZE, s.size * 1.2) }))}>
                <Plus className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <span className="mx-0.5 h-5 w-px bg-[#e6dccd]" />
              <CtrlBtn label="Editează textul" onClick={editSelectedText}>
                <Pencil className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <CtrlBtn label="Șterge" onClick={deleteSelectedText}>
                <Trash2 className="size-4 text-[#b0463c]" strokeWidth={2} />
              </CtrlBtn>
            </div>
          )}

          {/* Bara item-ului (imagine) selectat: deschide detaliul, z-order, eliminare. */}
          {selectedItem && !textDraft && (
            <div
              className="absolute z-[7] flex -translate-y-full items-center gap-0.5 rounded-lg border border-[#e6dccd] bg-white/95 p-1 shadow-md"
              style={{
                left: Math.max(0, selectedItem.x * dims.w),
                top: Math.max(28, selectedItem.y * dims.h) - 8,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {selectedSource && (
                <a
                  href={`/details/${selectedSource.detailId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Deschide detaliul"
                  title={`Deschide „${selectedSource.title}"`}
                  className="flex size-7 items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-secondary"
                >
                  <ExternalLink className="size-4" strokeWidth={2} />
                </a>
              )}
              <CtrlBtn label="Adu în față" onClick={bringToFront}>
                <BringToFront className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <CtrlBtn label="Trimite în spate" onClick={sendToBack}>
                <SendToBack className="size-4" strokeWidth={2} />
              </CtrlBtn>
              <span className="mx-0.5 h-5 w-px bg-[#e6dccd]" />
              <CtrlBtn label="Elimină de pe planșă" onClick={removeSelectedItem}>
                <Trash2 className="size-4 text-[#b0463c]" strokeWidth={2} />
              </CtrlBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function clampItemSize(n: number): number {
  return Math.min(MAX_ITEM_SIZE, Math.max(MIN_ITEM_SIZE, n));
}

// Desenează item-urile (sortate cresc. după z): imaginea detaliului sau placeholder „Detaliu indisponibil".
// Pe item-ul selectat desenează conturul + cele 4 handle-uri de colț (doar pe canvasul live, nu la export —
// exportul pasează selectedId null).
function drawItems(
  ctx: CanvasRenderingContext2D,
  items: CanvasItem[],
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
  selectedId: string | null,
) {
  const sorted = [...items].sort((a, b) => a.z - b.z);
  for (const it of sorted) {
    const x = it.x * width;
    const y = it.y * height;
    const w = it.width * width;
    const h = it.height * height;
    const img = images.get(it.detailId);
    if (img) {
      ctx.drawImage(img, x, y, w, h);
    } else {
      // Placeholder: detaliu dispărut/nepublicat sau imagine încă neîncărcată.
      ctx.fillStyle = "rgba(120,105,80,0.08)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(120,105,80,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(120,105,80,0.6)";
      ctx.font = `500 ${Math.max(10, Math.min(13, w * 0.05))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Detaliu indisponibil", x + w / 2, y + h / 2, w - 8);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    if (selectedId === it.id) {
      ctx.save();
      ctx.strokeStyle = "rgba(169,87,58,0.9)"; // teracota brand
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      // Handle-uri de colț (pătrate pline).
      const hs = 7;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(169,87,58,0.95)";
      for (const [cx, cy] of [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ]) {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
      }
      ctx.restore();
    }
  }
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a59a88]">{children}</div>
  );
}
function RailDivider() {
  return <div className="h-px w-[46px] flex-none bg-[#eee6da]" />;
}

function CtrlBtn({
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
