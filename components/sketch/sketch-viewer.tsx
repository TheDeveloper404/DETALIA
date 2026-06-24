"use client";

import { useEffect, useRef, useState } from "react";

import { renderStrokes } from "@/lib/sketch-render";
import type { Stroke } from "@/server/domain/sketch";

// Viewer read-only: imaginea-mamă (intensitate normală) + stroke-urile schiței deasupra.
export function SketchViewer({ imageUrl, strokes }: { imageUrl: string; strokes: Stroke[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let observer: ResizeObserver | null = null;
    img.onload = () => {
      imgRef.current = img;
      const setSize = () => {
        const container = containerRef.current;
        if (!container) return;
        const w = container.clientWidth;
        setDims({ w, h: Math.round(w * (img.naturalHeight / img.naturalWidth)) });
      };
      setSize();
      observer = new ResizeObserver(setSize);
      if (containerRef.current) observer.observe(containerRef.current);
    };
    img.src = imageUrl;
    return () => observer?.disconnect();
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = imgRef.current;
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    renderStrokes(ctx, strokes, canvas.width, canvas.height);
  }, [dims, strokes]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <canvas ref={canvasRef} width={dims.w} height={dims.h} className="block w-full" style={{ height: dims.h }} />
    </div>
  );
}
