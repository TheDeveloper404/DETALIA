"use client";

import { useState } from "react";

import {
  addDetailToCanvasAction,
  createCanvasAndAddDetailAction,
  getMyCanvasesForPicker,
} from "@/app/(app)/canvases/canvas-list-actions";

type Picker = { id: string; name: string };
type Added = { canvasId: string; name: string };

// Logica „Trimite în Planșă" extrasă din send-to-canvas-button.tsx ca să poată fi refolosită de un al
// doilea trigger (meniul kebab al detaliului) fără duplicare — starea și apelurile server rămân identice,
// doar prezentarea (popover ancorat vs. modal) diferă între cei doi consumatori.
export function useSendToCanvas(detailId: string) {
  const [loading, setLoading] = useState(false);
  const [canvases, setCanvases] = useState<Picker[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setAdded(null);
    setError(null);
    if (canvases === null) {
      setLoading(true);
      try {
        setCanvases(await getMyCanvasesForPicker());
      } catch {
        setError("Nu am putut încărca planșele.");
      } finally {
        setLoading(false);
      }
    }
  };

  const reset = () => {
    setCreating(false);
    setNewName("");
  };

  const addToExisting = async (c: Picker) => {
    setBusy(true);
    setError(null);
    const res = await addDetailToCanvasAction(c.id, detailId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Nu am putut adăuga.");
      return;
    }
    setAdded({ canvasId: c.id, name: c.name });
  };

  const createAndAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const res = await createCanvasAndAddDetailAction(trimmed, detailId);
    setBusy(false);
    if (!res.ok || !res.canvasId) {
      setError(res.error ?? "Nu am putut crea planșa.");
      return;
    }
    setAdded({ canvasId: res.canvasId, name: trimmed });
    setCreating(false);
    setNewName("");
    setCanvases((prev) => [{ id: res.canvasId!, name: trimmed }, ...(prev ?? [])]);
  };

  return {
    loading,
    canvases,
    busy,
    error,
    added,
    creating,
    newName,
    setNewName,
    setCreating,
    addToExisting,
    createAndAdd,
    load,
    reset,
  };
}

export type { Picker as SendToCanvasPicker };
