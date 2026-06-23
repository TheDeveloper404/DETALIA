"use client";

import { useState } from "react";

import { SketchCanvas } from "@/components/sketch/sketch-canvas";

// Wrapper de preview pentru editorul de schiță: randează canvas-ul real cu handlere NO-OP
// (în preview nu salvăm/trimitem nimic — fără DB/auth). Doar ca să se vadă uneltele.
export function SketchPreviewClient() {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <SketchCanvas
        imageUrl="/preview/detail.svg"
        initialStrokes={[]}
        onSaveDraft={() => setNote("(preview) Ciorna nu se salvează — fără DB.")}
        onSend={() => setNote("(preview) Trimiterea e dezactivată — fără DB.")}
      />
      {note && <p className="text-right text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
