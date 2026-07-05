"use client";

// Editorul de Planșă — montează Excalidraw (canvas infinit) peste scena persistată + reconciliază items-urile
// planșei (detalii adăugate din popover-ul feed) cu elementele din scenă. STRICT privat.
//
// Excalidraw se încarcă DOAR pe client (dynamic ssr:false) — atinge API-uri de browser la render.
// Fonturile sunt SELF-HOSTATE din public/excalidraw-assets (window.EXCALIDRAW_ASSET_PATH), NU de pe CDN
// extern → zero relaxare de CSP (spre deosebire de tldraw, care cerea cdn.tldraw.com; înlocuit 2026-07-05).

import { convertToExcalidrawElements, exportToBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { ArrowLeft, Download, ExternalLink, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  removeDetailFromCanvasAction,
  saveCanvasStateAction,
  saveCanvasThumbnailAction,
} from "./canvas-actions";

// Fonturile Excalidraw se servesc din același origin → CSP `font-src 'self'` le acoperă, fără CDN terț.
// Trebuie setat ÎNAINTE ca Excalidraw să-și ceară fonturile (modul „use client", înainte de lazy import).
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
}

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

// API imperativ Excalidraw — tipăm doar metodele folosite (tipurile complete nu-s exportate din entry-point).
type ExcalidrawFile = { id: string; mimeType: string; dataURL: string; created: number };
type ExcalidrawElementLike = {
  id: string;
  type: string;
  fileId?: string | null;
  customData?: Record<string, unknown> | null;
  isDeleted?: boolean;
};
type ExcalidrawApi = {
  getSceneElements: () => readonly ExcalidrawElementLike[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, ExcalidrawFile>;
  addFiles: (files: ExcalidrawFile[]) => void;
  updateScene: (scene: { elements?: unknown[]; captureUpdate?: unknown }) => void;
};

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
  initialState: unknown; // scenă serializată Excalidraw ({ elements, appState, files }) sau {} gol
  items: CanvasEditItem[]; // detaliile accesibile din index (pt materializare + reconciliere)
};

// fileId determinist per detaliu → reconcilierea e idempotentă între reîncărcări.
const fileIdForDetail = (detailId: string) => `detail-${detailId}`;

// Scena inițială = scena persistată + reconciliere cu items (materializează detalii noi, placeholder pt cele
// dispărute). Calculată SINCRON înainte de mount → o pasăm ca initialData (fără reconciliere async post-mount,
// care ar depinde de ordinea de inițializare a API-ului).
function buildInitialScene(initialState: unknown, items: CanvasEditItem[]) {
  const stored =
    initialState && typeof initialState === "object" && !Array.isArray(initialState)
      ? (initialState as {
          elements?: unknown[];
          appState?: Record<string, unknown>;
          files?: Record<string, ExcalidrawFile>;
        })
      : {};

  const elements: ExcalidrawElementLike[] = Array.isArray(stored.elements)
    ? (stored.elements as ExcalidrawElementLike[])
    : [];
  const files: Record<string, ExcalidrawFile> = { ...(stored.files ?? {}) };
  const appState = stored.appState ?? {};

  const accessible = new Map(items.map((it) => [it.detailId, it]));

  // Detalii deja prezente ca elemente (după customData.detailId).
  const present = new Set<string>();
  for (const el of elements) {
    const detailId = typeof el.customData?.detailId === "string" ? (el.customData.detailId as string) : null;
    if (!detailId || el.isDeleted) continue;
    present.add(detailId);
    // Detaliu dispărut → înlocuiește sursa fișierului cu placeholder (păstrează poziția/mărimea).
    if (
      !accessible.has(detailId) &&
      el.fileId &&
      files[el.fileId] &&
      files[el.fileId].dataURL !== PLACEHOLDER_SRC
    ) {
      files[el.fileId] = { ...files[el.fileId], dataURL: PLACEHOLDER_SRC };
    }
  }

  // Items accesibile fără element încă → creează fișier + element imagine (plasare în grilă, zonă liberă).
  const newSkeletons: Record<string, unknown>[] = [];
  let idx = present.size;
  for (const it of items) {
    if (present.has(it.detailId)) continue;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const fileId = fileIdForDetail(it.detailId);
    files[fileId] = {
      id: fileId,
      mimeType: "image/png",
      // dataURL acceptă și un URL remote (Excalidraw îl încarcă) → nu embed-uim base64 în state.
      dataURL: it.imageUrl,
      created: Date.now(),
    };
    newSkeletons.push({
      type: "image",
      fileId,
      status: "saved",
      x: 80 + col * (DEFAULT_W + 60),
      y: 80 + row * (DEFAULT_H + 80),
      width: DEFAULT_W,
      height: DEFAULT_H,
      customData: { detailId: it.detailId },
    });
    idx++;
  }

  const newElements = newSkeletons.length
    ? (convertToExcalidrawElements(newSkeletons as never) as unknown as ExcalidrawElementLike[])
    : [];

  const allElements = [...elements, ...newElements];
  // Prima deschidere (fără scroll persistat) → centrează pe conținut ca userul să-și vadă detaliile.
  const scrollToContent = !stored.appState && allElements.length > 0;

  return { elements: allElements, appState, files, scrollToContent };
}

// Semnătură ușoară a scenei (versiuni + nr. elemente/fișiere) → autosave sare peste onChange-uri care schimbă
// DOAR selecția/viewport-ul (nu conținutul).
function sceneSignature(elements: readonly ExcalidrawElementLike[], files: Record<string, unknown>): string {
  let v = 0;
  for (const el of elements) v += (el as { version?: number }).version ?? 0;
  return `${elements.length}:${Object.keys(files).length}:${v}`;
}

export default function CanvasEditor({ canvasId, name, initialState, items }: Props) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const [saved, setSaved] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<{ elementId: string; detailId: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThumb = useRef(0);
  const lastSig = useRef<string | null>(null);
  // Oglindă a selecției curente — Excalidraw cheamă onChange la FIECARE render; fără gard, un setState cu
  // obiect nou de fiecare dată re-declanșează render→onChange la infinit („Maximum update depth exceeded").
  const lastSelectedId = useRef<string | null>(null);

  const initialData = useMemo(() => buildInitialScene(initialState, items), [initialState, items]);

  const persist = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();

    const stateJson = serializeAsJSON(elements as never, appState as never, files as never, "local");
    const res = await saveCanvasStateAction(canvasId, stateJson);
    if (res.ok) setSaved(true);

    // Thumbnail throttled (randare + upload sunt scumpe) — o dată la ~20s, pe fundal, best-effort.
    if (Date.now() - lastThumb.current > THUMB_THROTTLE_MS && elements.length > 0) {
      lastThumb.current = Date.now();
      try {
        const blob = await exportToBlob({
          elements: elements as never,
          appState: appState as never,
          files: files as never,
          mimeType: "image/png",
          exportPadding: 24,
        });
        if (blob) {
          const fd = new FormData();
          fd.append("canvasId", canvasId);
          fd.append("thumbnail", blob, "canvas.png");
          await saveCanvasThumbnailAction(fd);
        }
      } catch {
        // thumbnail e nice-to-have; o eroare nu trebuie să deranjeze editarea
      }
    }
  }, [canvasId]);

  const onChange = useCallback(
    (
      elements: readonly ExcalidrawElementLike[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>,
    ) => {
      // 1) Selecție: un singur element-detaliu selectat → overlay „Deschide / Elimină".
      // Gard cu ref: setState DOAR când selecția s-a schimbat efectiv (altfel loop infinit, vezi lastSelectedId).
      const selectedIds = Object.keys((appState.selectedElementIds as Record<string, boolean>) ?? {});
      let next: { elementId: string; detailId: string } | null = null;
      if (selectedIds.length === 1) {
        const el = elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
        const detailId =
          el && typeof el.customData?.detailId === "string" ? (el.customData.detailId as string) : null;
        if (el && detailId) next = { elementId: el.id, detailId };
      }
      if ((next?.elementId ?? null) !== lastSelectedId.current) {
        lastSelectedId.current = next?.elementId ?? null;
        setSelectedDetail(next);
      }

      // 2) Autosave: doar dacă s-a schimbat CONȚINUTUL (nu selecția/viewport-ul).
      const sig = sceneSignature(elements, files);
      if (sig === lastSig.current) return;
      lastSig.current = sig;
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
    },
    [persist],
  );

  const exportPng = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) return;
    const blob = await exportToBlob({
      elements: elements as never,
      appState: api.getAppState() as never,
      files: api.getFiles() as never,
      mimeType: "image/png",
      exportPadding: 32,
    });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "plansa"}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name]);

  const removeSelected = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !selectedDetail) return;
    const res = await removeDetailFromCanvasAction(canvasId, selectedDetail.detailId);
    if (!res.ok) return;
    const remaining = api.getSceneElements().filter((e) => e.id !== selectedDetail.elementId);
    api.updateScene({ elements: remaining as unknown[] });
    lastSelectedId.current = null;
    setSelectedDetail(null);
  }, [canvasId, selectedDetail]);

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
        <span className="font-mono text-[11px] text-muted-foreground">
          {saved ? "salvat ✓" : "se salvează…"}
        </span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportPng}>
            <Download className="size-4" strokeWidth={2} />
            Export PNG
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="relative flex-1">
        <Excalidraw
          initialData={initialData as never}
          excalidrawAPI={(api: unknown) => {
            apiRef.current = api as ExcalidrawApi;
          }}
          onChange={onChange as never}
          langCode="ro-RO"
        />

        {/* Overlay acțiuni pe instanța de detaliu selectată. */}
        {selectedDetail && (
          <div className="pointer-events-auto absolute left-1/2 top-3 z-[400] flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card px-2 py-1.5 shadow-lg">
            <a
              href={`/details/${selectedDetail.detailId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3.5" strokeWidth={2} />
              Deschide detaliul
            </a>
            <button
              type="button"
              onClick={() => void removeSelected()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              Elimină de pe planșă
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
