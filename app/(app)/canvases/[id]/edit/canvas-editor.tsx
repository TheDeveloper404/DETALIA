"use client";

// Editorul de Planșă — montează tldraw (canvas infinit) peste snapshot-ul persistat + reconciliază
// items-urile planșei (detalii adăugate din popover-ul feed) cu shape-urile din store. STRICT privat.
//
// tldraw se încarcă DOAR pe client (dynamic ssr:false) — componenta atinge API-uri de browser la render.
// Utilitarele (getSnapshot/loadSnapshot/AssetRecordType/...) se importă normal (nu ating window la import).

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssetRecordType,
  getSnapshot,
  loadSnapshot,
  useEditor,
  useValue,
  type Editor,
  type TLImageShape,
  type TLShapeId,
  type TLStoreSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";

import { Button } from "@/components/ui/button";
import {
  removeDetailFromCanvasAction,
  saveCanvasStateAction,
  saveCanvasThumbnailAction,
} from "./canvas-actions";

const Tldraw = dynamic(() => import("tldraw").then((m) => m.Tldraw), { ssr: false });

// Placeholder afișat când detaliul din spatele unei instanțe a dispărut (șters/nepublicat) — păstrăm poziția.
const PLACEHOLDER_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="270"><rect width="100%" height="100%" fill="#f0ece4" stroke="#d6cfc2" stroke-width="2"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#8a8172" text-anchor="middle" dominant-baseline="middle">Detaliu indisponibil</text></svg>`,
  );

const DEFAULT_W = 360;
const DEFAULT_H = 270;
const AUTOSAVE_MS = 2000;
const THUMB_THROTTLE_MS = 20000;

export type CanvasEditItem = { detailId: string; imageUrl: string; title: string };

type Props = {
  canvasId: string;
  name: string;
  initialState: unknown; // snapshot document tldraw (sau {} gol)
  items: CanvasEditItem[]; // detaliile accesibile din index (pt materializare + reconciliere)
};

// meta.detailId al unui shape (dacă e o instanță de detaliu). Restul shape-urilor (schița liberă) n-au.
function shapeDetailId(shape: { meta?: Record<string, unknown> }): string | null {
  const id = shape.meta?.detailId;
  return typeof id === "string" ? id : null;
}

export default function CanvasEditor({ canvasId, name, initialState, items }: Props) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThumb = useRef(0);
  const reconciled = useRef(false);

  const persist = useCallback(
    async (ed: Editor) => {
      const { document } = getSnapshot(ed.store);
      const res = await saveCanvasStateAction(canvasId, JSON.stringify(document));
      if (res.ok) setSaved(true);

      // Thumbnail throttled (randare + upload sunt scumpe) — o dată la ~20s, pe fundal, best-effort.
      if (Date.now() - lastThumb.current > THUMB_THROTTLE_MS) {
        lastThumb.current = Date.now();
        try {
          const ids = ed.getCurrentPageShapeIds();
          if (ids.size > 0) {
            const img = await ed.toImage([...ids], { format: "png", background: true, padding: 24 });
            if (img?.blob) {
              const fd = new FormData();
              fd.append("canvasId", canvasId);
              fd.append("thumbnail", img.blob, "canvas.png");
              await saveCanvasThumbnailAction(fd);
            }
          }
        } catch {
          // thumbnail e nice-to-have; o eroare nu trebuie să deranjeze editarea
        }
      }
    },
    [canvasId],
  );

  const scheduleSave = useCallback(
    (ed: Editor) => {
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(ed), AUTOSAVE_MS);
    },
    [persist],
  );

  const handleMount = useCallback(
    (ed: Editor) => {
      setEditor(ed);

      // 1) Încarcă snapshot-ul persistat (dacă are conținut).
      if (initialState && typeof initialState === "object" && Object.keys(initialState).length > 0) {
        try {
          loadSnapshot(ed.store, { document: initialState as TLStoreSnapshot });
        } catch {
          // snapshot corupt / incompatibil — pornim de la o planșă goală, nu crăpăm
        }
      }

      // 2) Reconciliere index ↔ shape-uri (o singură dată la mount).
      if (!reconciled.current) {
        reconciled.current = true;
        reconcile(ed, items);
      }

      // 3) Autosave la orice modificare de document făcută de user.
      ed.store.listen(() => scheduleSave(ed), { scope: "document", source: "user" });
    },
    [initialState, items, scheduleSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const exportPng = useCallback(async () => {
    if (!editor) return;
    const ids = editor.getCurrentPageShapeIds();
    if (ids.size === 0) return;
    const img = await editor.toImage([...ids], { format: "png", background: true, padding: 32, scale: 2 });
    if (!img?.blob) return;
    const url = URL.createObjectURL(img.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "plansa"}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor, name]);

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Antet */}
      <header className="flex items-center gap-3 border-b bg-card px-3 py-2">
        <Link
          href="/canvases"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Planșele mele
        </Link>
        <span className="truncate font-medium">{name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {saved ? "salvat ✓" : "se salvează…"}
        </span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportPng} disabled={!editor}>
            <Download className="size-4" strokeWidth={2} />
            Export PNG
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="relative flex-1">
        <Tldraw onMount={handleMount}>
          <SelectionActions canvasId={canvasId} />
        </Tldraw>
      </div>
    </div>
  );
}

// Materializează shape-uri pentru items adăugate din popover (nu-s încă în snapshot) + pune placeholder pe
// shape-urile al căror detaliu a dispărut. Rulează o dată la mount.
function reconcile(ed: Editor, items: CanvasEditItem[]) {
  const accessible = new Map(items.map((it) => [it.detailId, it]));
  const shapes = ed.getCurrentPageShapes();

  const present = new Set<string>();
  for (const shape of shapes) {
    const detailId = shapeDetailId(shape);
    if (!detailId) continue;
    present.add(detailId);
    // Detaliu dispărut → înlocuiește sursa asset-ului cu placeholder (păstrează poziția/mărimea).
    if (!accessible.has(detailId) && shape.type === "image") {
      const assetId = (shape as TLImageShape).props.assetId;
      if (assetId) {
        const asset = ed.getAsset(assetId);
        if (asset && asset.type === "image" && asset.props.src !== PLACEHOLDER_SRC) {
          ed.updateAssets([{ ...asset, props: { ...asset.props, src: PLACEHOLDER_SRC } }]);
        }
      }
    }
  }

  // Items accesibile care nu au încă un shape → creează-le (plasare în grilă, zonă liberă).
  let idx = present.size;
  for (const it of items) {
    if (present.has(it.detailId)) continue;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const assetId = AssetRecordType.createId();
    ed.createAssets([
      AssetRecordType.create({
        id: assetId,
        type: "image",
        props: {
          src: it.imageUrl,
          w: DEFAULT_W,
          h: DEFAULT_H,
          mimeType: "image/png",
          name: it.title,
          isAnimated: false,
        },
      }),
    ]);
    ed.createShape({
      type: "image",
      x: 80 + col * (DEFAULT_W + 60),
      y: 80 + row * (DEFAULT_H + 80),
      props: { assetId, w: DEFAULT_W, h: DEFAULT_H },
      meta: { detailId: it.detailId },
    });
    idx++;
  }
}

// Overlay de acțiuni pe instanța de detaliu selectată: „Deschide detaliul" + „Elimină de pe planșă".
// Rulează în contextul tldraw (are acces la editor). Se afișează doar când e selectat un singur shape-detaliu.
function SelectionActions({ canvasId }: { canvasId: string }) {
  const editor = useEditor();
  const selected = useValue("selected-detail", () => editor.getSelectedShapes(), [editor]);

  const only = selected.length === 1 ? selected[0] : null;
  const detailId = only ? shapeDetailId(only) : null;
  if (!only || !detailId) return null;

  const remove = async () => {
    const res = await removeDetailFromCanvasAction(canvasId, detailId);
    if (res.ok) editor.deleteShapes([only.id as TLShapeId]);
  };

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-[400] flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-2 py-1.5 shadow-lg"
      style={{ pointerEvents: "auto" }}
    >
      <a
        href={`/details/${detailId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLink className="size-3.5" strokeWidth={2} />
        Deschide detaliul
      </a>
      <button
        type="button"
        onClick={() => void remove()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" strokeWidth={2} />
        Elimină de pe planșă
      </button>
    </div>
  );
}
