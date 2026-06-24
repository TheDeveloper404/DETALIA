"use client";

import { SketchCanvas } from "@/components/sketch/sketch-canvas";

// Wrapper de preview pentru editorul de schiță: randează suprafața reală de desen (rail + canvas)
// într-un container cu înălțime fixă — în preview nu salvăm/trimitem nimic (fără DB/auth).
export function SketchPreviewClient() {
  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border border-border">
      <SketchCanvas imageUrl="/preview/detail.svg" initialStrokes={[]} />
    </div>
  );
}
