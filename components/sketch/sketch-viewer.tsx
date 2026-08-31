"use client";

import { useEffect, useRef, useState } from "react";

import { mapCanvasCoord, renderStrokes, strokesUsePasteboard } from "@/lib/sketch-render";
import { PASTEBOARD_MARGIN, type Stroke } from "@/server/domain/sketch";

const M = PASTEBOARD_MARGIN;

// Overlay read-only: DOAR stroke-urile schiței, suprapuse peste imaginea-mamă deja randată de părinte
// (<Image fill object-contain> permanent montată în cutia 4/3). Canvas-ul se poziționează exact pe
// dreptunghiul „contain" al imaginii în cutie — imaginea nu se remontează la comutarea taburilor,
// deci nimic nu „pocnește"/tremură; doar stroke-urile apar/dispar deasupra ei.
// `veil`: foaia semitransparentă peste detaliul-mamă. Are sens la SCHIȚA ALTCUIVA (semnal că te uiți la
// propunerea lui peste desenul mamă). La ADNOTAREA autorului pe propria imagine e greșit — nu e o foaie
// pusă peste altceva, sunt notițe pe propriul desen; estomparea ar face imaginea doar mai greu de citit.
export function SketchViewer({
  imageUrl,
  strokes,
  veil = true,
}: {
  imageUrl: string;
  strokes: Stroke[];
  veil?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Avem nevoie de raportul natural al imaginii ca să calculăm dreptunghiul „contain" (identic cu
  // object-contain de pe <Image>). Imaginea e deja afișată de părinte; aici doar îi citim dimensiunile.
  useEffect(() => {
    // FĂRĂ crossOrigin: citim doar naturalWidth/Height (nu desenăm imaginea pe canvas) — cu
    // crossOrigin, un host fără CORS ar face onload să nu mai vină → stroke-urile ar dispărea silențios.
    const img = new Image();
    let observer: ResizeObserver | null = null;
    img.onload = () => {
      const setSize = () => {
        const container = containerRef.current;
        if (!container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const ratio = img.naturalHeight / img.naturalWidth;
        let w = cw;
        let h = cw * ratio;
        if (ch > 0 && h > ch) {
          h = ch;
          w = ch / ratio;
        }
        setRect({ x: (cw - w) / 2, y: (ch - h) / 2, w: Math.round(w), h: Math.round(h) });
      };
      setSize();
      observer = new ResizeObserver(setSize);
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl]);

  // Stroke-urile pot ieși din dreptunghiul imaginii [0,1]. Când o schiță folosește zona din jur,
  // canvas-ul CREȘTE în jurul imaginii (imaginea rămâne la mărime normală, în centru) — nu se
  // micșorează nimic. Partea din desen care iese din card poate fi decupată de `overflow-hidden`;
  // marginea e mică (~15%), deci în practică textul/săgețile de lângă imagine se văd.
  const margin = strokesUsePasteboard(strokes) ? M : 0;
  const canvasW = Math.round(rect.w * (1 + 2 * margin));
  const canvasH = Math.round(rect.h * (1 + 2 * margin));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Foaia semitransparentă a schiței — DOAR peste dreptunghiul detaliului-mamă (centrul canvas-ului
    // când e activă zona din jur), nu peste ea. IDENTIC cu editorul (sketch-canvas.tsx).
    if (veil) {
      const x0 = mapCanvasCoord(0, canvas.width, margin);
      const y0 = mapCanvasCoord(0, canvas.height, margin);
      ctx.fillStyle = "rgba(250,247,241,0.55)";
      ctx.fillRect(x0, y0, canvas.width - 2 * x0, canvas.height - 2 * y0);
    }
    renderStrokes(ctx, strokes, canvas.width, canvas.height, { margin });
  }, [rect, strokes, veil, margin]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="absolute"
        style={{
          left: rect.x - margin * rect.w,
          top: rect.y - margin * rect.h,
          width: canvasW,
          height: canvasH,
        }}
      />
    </div>
  );
}
