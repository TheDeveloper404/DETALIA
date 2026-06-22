"use client";

import { useState } from "react";

import { SketchCanvas } from "@/components/sketch/sketch-canvas";
import type { Stroke } from "@/server/domain/sketch";

import { saveStrokesAction, sendSketchAction } from "./sketch-actions";

// Leagă canvas-ul de server actions (save ciornă + trimite). Gestionează pending/error/„salvat".
export function SketchEditor({
  sketchId,
  detailId,
  imageUrl,
  initialStrokes,
}: {
  sketchId: string;
  detailId: string;
  imageUrl: string;
  initialStrokes: Stroke[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSaveDraft(strokes: Stroke[]) {
    setPending(true);
    setError(null);
    setSavedAt(null);
    const res = await saveStrokesAction(sketchId, JSON.stringify(strokes));
    setPending(false);
    if (!res.ok) setError(res.error ?? "Nu am putut salva.");
    else setSavedAt(Date.now());
  }

  async function handleSend(strokes: Stroke[], thumbnail: Blob | null) {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("sketchId", sketchId);
    fd.set("detailId", detailId);
    fd.set("strokes", JSON.stringify(strokes));
    if (thumbnail) fd.set("thumbnail", thumbnail, "thumbnail.png");
    const res = await sendSketchAction(fd); // pe succes redirecționează (nu mai revine)
    setPending(false);
    if (res && !res.ok) setError(res.error ?? "Nu am putut trimite.");
  }

  return (
    <div className="flex flex-col gap-2">
      <SketchCanvas
        imageUrl={imageUrl}
        initialStrokes={initialStrokes}
        onSaveDraft={handleSaveDraft}
        onSend={handleSend}
        pending={pending}
        error={error}
      />
      {savedAt && <p className="text-right text-xs text-emerald-600 dark:text-emerald-400">Ciornă salvată.</p>}
    </div>
  );
}
