"use client";

import { useEffect, useRef, useState } from "react";

import { renderStrokes } from "@/lib/sketch-render";
import { TEXT_MARGIN, type Stroke } from "@/server/domain/sketch";

// Overlay read-only: DOAR stroke-urile schiței, suprapuse peste imaginea-mamă deja randată de părinte
// (<Image fill object-contain> permanent montată în cutia 4/3). Canvas-ul se poziționează exact pe
// dreptunghiul „contain" al imaginii în cutie — imaginea nu se remontează la comutarea taburilor,
// deci nimic nu „pocnește"/tremură; doar stroke-urile apar/dispar deasupra ei.
// Canvas-ul e mai mare decât dreptunghiul „contain" (+ TEXT_MARGIN pe fiecare parte) ca textul scris în
// marginea foii (editor) să rămână vizibil și la citire, nu doar în editor — vezi server/domain/sketch.ts.
export function SketchViewer({ imageUrl, strokes }: { imageUrl: string; strokes: Stroke[] }) {
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

  const marginX = Math.round(rect.w * TEXT_MARGIN);
  const marginY = Math.round(rect.h * TEXT_MARGIN);
  const canvasW = rect.w + marginX * 2;
  const canvasH = rect.h + marginY * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Foaia semitransparentă a schiței peste detaliul-mamă (care rămâne opac, randat de părinte) — IDENTIC
    // cu editorul (sketch-canvas.tsx): schița stă pe o coală translucidă peste detaliu, nu invers.
    ctx.fillStyle = "rgba(250,247,241,0.55)";
    ctx.fillRect(marginX, marginY, rect.w, rect.h);
    // Stroke-urile sunt normalizate față de imagine (rect.w/h) — translatăm cu marginea, IDENTIC cu
    // editorul, ca textul din margine să cadă la fel pe canvas-ul (mai mare) de aici.
    ctx.save();
    ctx.translate(marginX, marginY);
    renderStrokes(ctx, strokes, rect.w, rect.h);
    ctx.restore();
  }, [rect, marginX, marginY, strokes]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="absolute"
        style={{ left: rect.x - marginX, top: rect.y - marginY, width: canvasW, height: canvasH }}
      />
    </div>
  );
}
