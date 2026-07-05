"use client";

// Shell-ul editorului de Planșă — montează PlansaCanvas (engine PROPRIU, client-only) peste documentul
// persistat + reconciliază items-urile (detalii adăugate din popover-ul feed) cu geometria din document.
// STRICT privat. Autosave debounced (2s) pe onChange + thumbnail throttled; Export PNG prin handle.

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { PlansaCanvas, type PlansaCanvasHandle, type PlansaItemSource } from "@/components/plansa/plansa-canvas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanvasDocument } from "@/server/domain/plansa";

import {
  removeDetailFromCanvasAction,
  saveCanvasDocumentAction,
  saveCanvasThumbnailAction,
} from "./canvas-actions";

const AUTOSAVE_MS = 2000;
const THUMB_THROTTLE_MS = 20000;

type Props = {
  canvasId: string;
  name: string;
  initialDocument: unknown; // CanvasDocument persistat sau null (planșă nouă)
  sources: PlansaItemSource[];
};

// Normalizează documentul persistat la forma așteptată de engine (null dacă lipsește/corupt — engine-ul
// reconciliază items din sources). Validarea reală e pe server la fiecare save; aici doar o gardă de formă.
function normalizeDocument(raw: unknown): CanvasDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  if (doc.version !== 1 || !Array.isArray(doc.items) || !Array.isArray(doc.strokes)) return null;
  return doc as unknown as CanvasDocument;
}

export default function CanvasEditor({ canvasId, name, initialDocument, sources }: Props) {
  const canvasRef = useRef<PlansaCanvasHandle>(null);
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThumb = useRef(0);

  const persist = useCallback(async () => {
    const handle = canvasRef.current;
    if (!handle) return;
    const doc = handle.getDocument();
    const res = await saveCanvasDocumentAction(canvasId, JSON.stringify(doc));
    if (res.ok) {
      setSaved(true);
      setSaveError(null);
    } else {
      setSaveError(res.error ?? "Planșa nu a putut fi salvată.");
    }

    // Thumbnail throttled (compunere + upload sunt scumpe) — o dată la ~20s, best-effort.
    if (Date.now() - lastThumb.current > THUMB_THROTTLE_MS) {
      lastThumb.current = Date.now();
      try {
        const blob = await handle.exportThumbnail();
        if (blob) {
          const fd = new FormData();
          fd.append("canvasId", canvasId);
          fd.append("thumbnail", blob, "canvas.png");
          await saveCanvasThumbnailAction(fd);
        }
      } catch {
        // thumbnail e nice-to-have; o eroare nu deranjează editarea
      }
    }
  }, [canvasId]);

  // onChange (fiecare modificare comisă în engine) → autosave debounced.
  const handleChange = useCallback(() => {
    setSaved(false);
    setSaveError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  // Eliminarea unui detaliu de pe planșă → șterge și din index (server); engine-ul l-a scos deja din document.
  const handleRemoveItem = useCallback(
    (detailId: string) => {
      void removeDetailFromCanvasAction(canvasId, detailId);
    },
    [canvasId],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const exportPng = useCallback(async () => {
    const handle = canvasRef.current;
    if (!handle) return;
    setExporting(true);
    try {
      const blob = await handle.exportThumbnail();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "plansa"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [name]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
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
        <span
          className={cn(
            "font-mono text-[11px]",
            saveError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {saveError ?? (saved ? "salvat ✓" : "se salvează…")}
        </span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportPng} disabled={exporting}>
            <Download className="size-4" strokeWidth={2} />
            Export PNG
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <PlansaCanvas
        ref={canvasRef}
        initialDocument={normalizeDocument(initialDocument)}
        sources={sources}
        onChange={handleChange}
        onRemoveItem={handleRemoveItem}
      />
    </div>
  );
}
