"use client";

// Shell-ul editorului de Planșă — montează PlansaCanvas (engine PROPRIU, client-only) peste documentul
// persistat + reconciliază items-urile (detalii adăugate din popover-ul feed) cu geometria din document.
// STRICT privat. Autosave debounced (2s) pe onChange + thumbnail throttled; Export PNG prin handle.

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PlansaCanvas, type PlansaCanvasHandle, type PlansaItemSource } from "@/components/plansa/plansa-canvas";
import { SupportHint } from "@/components/support/support-hint";
import { Button } from "@/components/ui/button";
import { uploadImageToBlob } from "@/lib/blob-upload";
import { cn } from "@/lib/utils";
import type { CanvasDocument } from "@/server/domain/plansa";

import {
  removeDetailFromCanvasAction,
  saveCanvasDocumentAction,
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
  const router = useRouter();
  const canvasRef = useRef<PlansaCanvasHandle>(null);
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Doar salvarile de document esuate la rand; thumbnail-ul nu se numara.
  const [saveFailures, setSaveFailures] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThumb = useRef(0);
  const revision = useRef(0);
  const saving = useRef<Promise<boolean>>(Promise.resolve(true));
  const thumbnailSaving = useRef(false);

  const persist = useCallback(() => {
    // Serializam salvarile; fiecare citeste documentul actual abia cand ii vine randul.
    const task = saving.current.then(async () => {
      const handle = canvasRef.current;
      if (!handle) return false;
      const savedRevision = revision.current;
      try {
        const res = await saveCanvasDocumentAction(canvasId, JSON.stringify(handle.getDocument()));
        if (!res.ok) {
          setSaveError(res.error ?? "Planșa nu a putut fi salvată.");
          setSaveFailures((n) => n + 1);
          return false;
        }
        // Un raspuns pentru versiunea veche nu marcheaza drept salvate modificarile mai noi.
        if (savedRevision === revision.current) setSaved(true);
        setSaveError(null);
        setSaveFailures(0);

        if (!thumbnailSaving.current && Date.now() - lastThumb.current > THUMB_THROTTLE_MS) {
          // Limitam incercarile, inclusiv cele esuate, ca thumbnail-ul sa nu consume cota documentului.
          lastThumb.current = Date.now();
          thumbnailSaving.current = true;
          // Miniatura este auxiliara: nu tine coada documentelor sau iesirea in asteptare.
          void (async () => {
            try {
              const blob = await handle.exportThumbnail("image/jpeg");
              if (blob) {
                const url = await uploadImageToBlob("canvases/uploads", new File([blob], "canvas.jpg", { type: blob.type }));
                const response = await fetch(`/api/canvases/${canvasId}/thumbnail`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ thumbnailUrl: url }),
                });
                if (!response.ok) {
                  const result = await response.json() as { error?: { message?: string } };
                  setSaveError(result.error?.message ?? "Thumbnail-ul nu a putut fi salvat.");
                }
              }
            } catch (err) {
              unstable_rethrow(err);
              setSaveError("Thumbnail-ul nu a putut fi salvat. Încearcă din nou.");
            } finally {
              thumbnailSaving.current = false;
            }
          })();
        }
        return true;
      } catch (err) {
        unstable_rethrow(err);
        setSaveError("Planșa nu a putut fi salvată. Încearcă din nou.");
        setSaveFailures((n) => n + 1);
        return false;
      }
    });
    saving.current = task;
    return task;
  }, [canvasId]);

  // onChange (fiecare modificare comisă în engine) → autosave debounced.
  const handleChange = useCallback(() => {
    revision.current += 1;
    setSaved(false);
    setSaveError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  // Eliminarea unui item de pe planșă → șterge și din index (server); engine-ul l-a scos deja din document.
  // sketchId prezent = item de schiță (server șterge doar rândul acelei schițe, nu detaliul-mamă).
  const handleRemoveItem = useCallback(
    (detailId: string, sketchId: string | null) => {
      void removeDetailFromCanvasAction(canvasId, detailId, sketchId);
    },
    [canvasId],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const leaveEditor = async () => {
    if (leaving) return;
    setLeaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      // Asteptam si autosave-ul deja pornit, apoi salvam ultima versiune inainte de navigare.
      let latestRevision: number;
      do {
        latestRevision = revision.current;
        if (!(await persist())) {
          setLeaving(false);
          return;
        }
      } while (latestRevision !== revision.current);
      router.push("/canvases");
    } catch (err) {
      setLeaving(false);
      throw err;
    }
  };

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
    <div inert={leaving} className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Antet */}
      <header className="flex items-center gap-3 border-b bg-secondary px-3 py-2">
        <Link
          href="/canvases"
          onNavigate={(event) => {
            event.preventDefault();
            void leaveEditor();
          }}
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
        {saveError && saveFailures > 0 && (
          <span className="text-[12px]">
            <SupportHint failures={saveFailures} flow="canvas_save" errorMessage={saveError} />
          </span>
        )}
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
