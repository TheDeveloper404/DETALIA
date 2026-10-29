"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export type ImageView = { zoom: number; x: number; y: number };
type Point = { x: number; y: number };
type Size = { width: number; height: number };

export function constrainImageView(view: ImageView, frame: Size, image: Size): ImageView {
  const zoom = Math.max(1, Math.min(3, view.zoom));
  const fit = Math.min(frame.width / image.width, frame.height / image.height);
  const maxX = Math.max(0, (image.width * fit * zoom - frame.width) / 2);
  const maxY = Math.max(0, (image.height * fit * zoom - frame.height) / 2);
  return {
    zoom,
    x: maxX ? Math.max(-maxX, Math.min(maxX, view.x)) : 0,
    y: maxY ? Math.max(-maxY, Math.min(maxY, view.y)) : 0,
  };
}

export function zoomImageView(view: ImageView, nextZoom: number, anchor: Point, frame: Size, image: Size): ImageView {
  const zoom = Math.max(1, Math.min(3, nextZoom));
  const ratio = zoom / view.zoom;
  return constrainImageView({
    zoom,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  }, frame, image);
}

export function DetailImageViewer({ imageUrl, alt, children }: {
  imageUrl: string;
  alt: string;
  children?: ReactNode;
}) {
  const [view, setView] = useState<ImageView>({ zoom: 1, x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef({ frame: { width: 1, height: 1 }, image: { width: 1, height: 1 } });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ view: ImageView; center: Point; distance: number } | null>(null);

  function startGesture() {
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      gestureRef.current = {
        view,
        center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) || 1,
      };
    } else if (points.length === 1 && view.zoom > 1) {
      gestureRef.current = { view, center: points[0], distance: 0 };
    } else {
      gestureRef.current = null;
    }
  }

  function pointInFrame(event: PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0 || view.zoom === 1) return;
    pointersRef.current.set(event.pointerId, pointInFrame(event));
    event.currentTarget.setPointerCapture(event.pointerId);
    startGesture();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, pointInFrame(event));
    moveGesture();
  }

  function moveGesture() {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const points = [...pointersRef.current.values()];
    const { frame, image } = geometryRef.current;
    if (points.length >= 2) {
      const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const zoomed = zoomImageView(gesture.view, gesture.view.zoom * distance / gesture.distance, gesture.center, frame, image);
      setView(constrainImageView({ ...zoomed, x: zoomed.x + center.x - gesture.center.x, y: zoomed.y + center.y - gesture.center.y }, frame, image));
    } else {
      setView(constrainImageView({ ...gesture.view, x: gesture.view.x + points[0].x - gesture.center.x, y: gesture.view.y + points[0].y - gesture.center.y }, frame, image));
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    pointersRef.current.delete(event.pointerId);
    startGesture();
  }

  function zoomBy(factor: number) {
    pointersRef.current.clear();
    gestureRef.current = null;
    const { frame, image } = geometryRef.current;
    setView((current) => zoomImageView(current, current.zoom * factor, { x: 0, y: 0 }, frame, image));
  }

  // Native non-passive touch listeners let a two-finger gesture take precedence over
  // page scrolling in every direction, without blocking one-finger scroll at 100%.
  useEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const readTouches = (event: TouchEvent) => {
      const rect = viewport.getBoundingClientRect();
      pointersRef.current.clear();
      for (const touch of Array.from(event.targetTouches)) {
        pointersRef.current.set(touch.identifier, { x: touch.clientX - rect.left - rect.width / 2, y: touch.clientY - rect.top - rect.height / 2 });
      }
    };
    const onStart = (event: TouchEvent) => {
      readTouches(event);
      if (pointersRef.current.size >= 2 || view.zoom > 1) event.preventDefault();
      startGesture();
    };
    const onMove = (event: TouchEvent) => {
      readTouches(event);
      if (pointersRef.current.size >= 2 || view.zoom > 1) {
        event.preventDefault();
        moveGesture();
      }
    };
    const onEnd = (event: TouchEvent) => {
      readTouches(event);
      startGesture();
    };
    content.addEventListener("touchstart", onStart, { passive: false });
    content.addEventListener("touchmove", onMove, { passive: false });
    content.addEventListener("touchend", onEnd);
    content.addEventListener("touchcancel", onEnd);
    return () => {
      content.removeEventListener("touchstart", onStart);
      content.removeEventListener("touchmove", onMove);
      content.removeEventListener("touchend", onEnd);
      content.removeEventListener("touchcancel", onEnd);
    };
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const frame = { width: entry.contentRect.width, height: entry.contentRect.height };
      geometryRef.current.frame = frame;
      const image = geometryRef.current.image;
      setView((current) => constrainImageView(current, frame, image));
    });
    observer.observe(viewport);
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      pointersRef.current.clear();
      gestureRef.current = null;
      const rect = viewport.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
      const { frame, image } = geometryRef.current;
      setView((current) => zoomImageView(current, current.zoom * (event.deltaY < 0 ? 1.1 : 0.9), anchor, frame, image));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      data-testid="detail-image-viewport"
      data-zoom={view.zoom}
      className={`relative z-[1] aspect-[4/3] w-full max-w-3xl overflow-hidden ${view.zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ touchAction: view.zoom > 1 ? "none" : "auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <div ref={contentRef} data-testid="detail-image-content" className="absolute inset-0 select-none" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <Image
          src={imageUrl}
          unoptimized={view.zoom > 1 || imageUrl.startsWith("/api/")}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 768px"
          className="object-contain"
          draggable={false}
          priority
          onLoad={(event) => {
            const rect = viewportRef.current?.getBoundingClientRect();
            if (!rect) return;
            const frame = { width: rect.width, height: rect.height };
            const image = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
            geometryRef.current = { frame, image };
            setView((current) => constrainImageView(current, frame, image));
          }}
        />
        {children}
      </div>
      <div role="group" aria-label="Zoom imagine" onPointerDown={(event) => event.stopPropagation()} className="absolute right-2 top-2 z-[3] flex items-center rounded-lg border border-border bg-card/95 shadow-sm">
        <button type="button" onClick={() => zoomBy(0.9)} aria-label="Micșorează imaginea" className="flex size-11 items-center justify-center rounded-l-lg hover:bg-secondary disabled:opacity-40" disabled={view.zoom === 1}>
          <ZoomOut className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" aria-label="Resetează zoom-ul" onClick={() => {
          pointersRef.current.clear();
          gestureRef.current = null;
          setView({ zoom: 1, x: 0, y: 0 });
        }} className="min-h-11 min-w-14 px-2 font-mono text-xs hover:bg-secondary">
          {Math.round(view.zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomBy(1.1)} aria-label="Mărește imaginea" className="flex size-11 items-center justify-center rounded-r-lg hover:bg-secondary disabled:opacity-40" disabled={view.zoom === 3}>
          <ZoomIn className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
