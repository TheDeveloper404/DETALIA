"use client";

import { Check, LayoutGrid, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// §7 din planul „Proiect" (Faza C): a treia sursă de imagine la /details/new — „dintr-o planșă". Fără
// schimbare de server: `canvases.thumbnailUrl` e deja un PNG compus client-side la fiecare salvare a
// planșei (vezi saveCanvasThumbnailAction) — aici doar alegem o planșă și decupăm o zonă din el, apoi
// exportăm regiunea ca File nou, care intră în EXACT pipeline-ul de upload existent (uploadImageToBlob),
// neschimbat. Fără restricție suplimentară de proprietate pe sursă (decizie explicită din plan — oricine
// poate oricum face un screenshot, deci bariera ar fi teatru de securitate fără beneficiu real); accesul
// la LISTA de planșe eligibile (doar ale userului) e singura gardă reală, deja impusă de `listMyCanvases`.

export type CropCanvasOption = { id: string; name: string; thumbnailUrl: string | null };

type Rect = { x: number; y: number; w: number; h: number }; // normalizat 0..1, față de imaginea afișată

const MIN_SIZE = 0.08; // sub asta decupajul devine inutilizabil (prea mic)

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// Constrânge un rect normalizat să rămână în interiorul [0,1]x[0,1], cu latura minimă MIN_SIZE.
// Exportată pentru test unitar — restul logicii de crop e interacțiune de mouse (nu testabilă unitar).
export function clampRect(r: Rect): Rect {
  const w = clamp(r.w, MIN_SIZE, 1);
  const h = clamp(r.h, MIN_SIZE, 1);
  const x = clamp(r.x, 0, 1 - w);
  const y = clamp(r.y, 0, 1 - h);
  return { x, y, w, h };
}

// Pas 2: crop propriu-zis pe o imagine deja aleasă. Imaginea umple exact containerul (fit-to-area,
// fără letterboxing) — coordonatele normalizate ale selecției mapează direct 1:1 pe containerul afișat,
// fără calcul suplimentar de offset.
function CropStage({
  imageUrl,
  onApply,
  onCancel,
}: {
  imageUrl: string;
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<
    | { kind: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; startRect: Rect }
    | null
  >(null);

  // Fit-to-area: imaginea umple containerul păstrând raportul ei natural (letterbox pe fundal, nu pe
  // imagine — dims descrie EXACT dreptunghiul imaginii afișate).
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const fit = () => {
        const c = containerRef.current;
        if (!c) return;
        const availW = c.clientWidth;
        const availH = c.clientHeight;
        if (availW <= 0 || availH <= 0) return;
        const ratio = img.naturalHeight / img.naturalWidth;
        let w = availW;
        let h = w * ratio;
        if (h > availH) {
          h = availH;
          w = h / ratio;
        }
        setDims({ w: Math.round(w), h: Math.round(h) });
      };
      fit();
      const observer = new ResizeObserver(fit);
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    };
    img.onerror = () => setError("Imaginea planșei nu a putut fi încărcată.");
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const onPointerDown = useCallback(
    (kind: "move" | "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = { kind, startX: e.clientX, startY: e.clientY, startRect: rect };
    },
    [rect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || dims.w === 0 || dims.h === 0) return;
      const dx = (e.clientX - drag.startX) / dims.w;
      const dy = (e.clientY - drag.startY) / dims.h;
      const s = drag.startRect;
      let next: Rect;
      switch (drag.kind) {
        case "move":
          next = { ...s, x: s.x + dx, y: s.y + dy };
          break;
        case "nw":
          next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
          break;
        case "ne":
          next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy };
          break;
        case "sw":
          next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy };
          break;
        case "se":
          next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy };
          break;
      }
      setRect(clampRect(next));
    },
    [dims],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  async function applyCrop() {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sx = Math.round(rect.x * img.naturalWidth);
      const sy = Math.round(rect.y * img.naturalHeight);
      const sw = Math.round(rect.w * img.naturalWidth);
      const sh = Math.round(rect.h * img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d indisponibil");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("export eșuat");
      onApply(new File([blob], "decupaj-plansa.png", { type: "image/png" }));
    } catch {
      setError("Decuparea a eșuat. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  const handles: { kind: "nw" | "ne" | "sw" | "se"; cls: string }[] = [
    { kind: "nw", cls: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { kind: "ne", cls: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { kind: "sw", cls: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
    { kind: "se", cls: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="relative flex h-[60vh] max-h-[620px] min-h-[380px] items-center justify-center overflow-hidden rounded-[14px] border border-[#e6ddcf] bg-[#efece6]"
      >
        {dims.w > 0 && (
          <div
            className="relative touch-none select-none"
            style={{ width: dims.w, height: dims.h }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- sursă decupată dinamic, nu asset optimizabil */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full select-none object-fill"
            />
            <div
              className="absolute cursor-move border-2 border-primary bg-primary/10"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
              onPointerDown={onPointerDown("move")}
            >
              {handles.map((h) => (
                <div
                  key={h.kind}
                  onPointerDown={onPointerDown(h.kind)}
                  className={cn(
                    "absolute size-4 rounded-full border-2 border-primary bg-white",
                    h.cls,
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="font-heading text-[13.5px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Alege altă planșă
        </button>
        <button
          type="button"
          onClick={applyCrop}
          disabled={busy || dims.w === 0}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-heading text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Check className="size-4" strokeWidth={2} />
          {busy ? "Se decupează…" : "Aplică decupajul"}
        </button>
      </div>
    </div>
  );
}

// Pas 1: grilă de planșe proprii, cu thumbnail. O planșă fără thumbnail (niciodată salvată încă) nu se
// poate folosi ca sursă — nu există nimic de decupat.
export function CanvasCropPicker({
  canvases,
  onApply,
  onCancel,
}: {
  canvases: CropCanvasOption[];
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<CropCanvasOption | null>(null);
  const usable = canvases.filter((c) => !!c.thumbnailUrl);

  if (selected?.thumbnailUrl) {
    return (
      <CropStage
        imageUrl={selected.thumbnailUrl}
        onApply={onApply}
        onCancel={() => setSelected(null)}
      />
    );
  }

  if (usable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[#d8cfc0] bg-[#faf7f1] px-6 py-10 text-center">
        <LayoutGrid className="size-6 text-muted-foreground" strokeWidth={1.8} />
        <p className="font-mono text-[12.5px] text-muted-foreground">
          Nu ai nicio planșă salvată cu conținut încă — desenează sau adaugă ceva pe o planșă din{" "}
          <span className="font-semibold">Planșele mele</span> înainte s-o poți folosi ca sursă.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="font-heading text-[13.5px] font-semibold text-primary hover:opacity-80"
        >
          Înapoi
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {usable.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c)}
            className="group relative overflow-hidden rounded-[12px] border border-[#e6ddcf] bg-[#efece6] text-left transition-colors hover:border-primary"
          >
            <div className="aspect-[4/3] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail dintr-un set variabil de planșe */}
              <img src={c.thumbnailUrl!} alt="" className="size-full object-cover" />
            </div>
            <div className="truncate border-t border-[#e6ddcf] bg-card px-2.5 py-1.5 font-mono text-[11.5px] text-foreground/80">
              {c.name}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 self-start font-heading text-[13.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" strokeWidth={2} />
        Renunță
      </button>
    </div>
  );
}
