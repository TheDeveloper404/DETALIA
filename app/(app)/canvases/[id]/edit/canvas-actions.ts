"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteBlobs, uploadSketchThumbnail } from "@/lib/storage";
import {
  removeDetailFromCanvas,
  saveCanvasState,
  saveCanvasThumbnail,
} from "@/server/services/canvasService";

export type CanvasEditActionResult = { ok: boolean; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Planșa nu mai există.",
  INVALID_STATE: "Planșa nu a putut fi salvată.",
  DETAIL_NOT_FOUND: "Detaliul nu mai există.",
  RATE_LIMITED: "Prea multe salvări. Așteaptă un moment.",
};

function parseState(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Autosave snapshot tldraw — doar owner-ul. Nu redirecționează.
// SEC-04 — EXCEPȚIE DELIBERATĂ (ca la schițe): autosave e hot-path (debounced la câteva secunde), un SELECT
// de status per apel ar costa degeaba; planșa e PRIVATĂ. Rămâne pe auth() (sesiune), nu pe status proaspăt.
export async function saveCanvasStateAction(
  canvasId: string,
  stateJson: string,
): Promise<CanvasEditActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // SEC-01: salvarea scrie în DB la fiecare apel (declanșată des din editor) → limită per user.
  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const res = await saveCanvasState({
    canvasId,
    ownerId: session.user.id,
    state: parseState(stateJson),
  });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut salva." };
  return { ok: true };
}

// Salvează thumbnail-ul planșei (PNG randat client-side din editor.toImage). Best-effort.
export async function saveCanvasThumbnailAction(
  formData: FormData,
): Promise<CanvasEditActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!(await checkLimit(limiters.mutation, session.user.id)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const canvasId = String(formData.get("canvasId") ?? "");
  const thumb = formData.get("thumbnail");
  if (!(thumb instanceof File) || thumb.size === 0) return { ok: true }; // nimic de urcat → no-op

  // SEC-02: câmpul de fișier e controlat de client → re-encodăm cu sharp (magic bytes + strip + plafon).
  const upload = await uploadSketchThumbnail(thumb);
  if (!upload.ok) return { ok: false, error: "Thumbnail-ul nu a putut fi salvat." };

  const res = await saveCanvasThumbnail({
    canvasId,
    ownerId: session.user.id,
    thumbnailUrl: upload.url,
  });
  if (!res.ok) {
    await deleteBlobs([upload.url]); // planșa nu-i a lui / a dispărut → blob orfan, curăță
    return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut salva thumbnail-ul." };
  }
  return { ok: true };
}

// Scoate un detaliu de pe planșă (din meniul contextual al instanței). Shape-ul îl șterge clientul din store.
export async function removeDetailFromCanvasAction(
  canvasId: string,
  detailId: string,
): Promise<CanvasEditActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await removeDetailFromCanvas({ canvasId, ownerId: userId, detailId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut elimina detaliul." };
  return { ok: true };
}
