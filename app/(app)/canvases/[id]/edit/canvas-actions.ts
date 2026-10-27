"use server";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { isUsersBlobUrl } from "@/lib/blob-url";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import {
  removeDetailFromCanvas,
  saveCanvasDocument,
  saveCanvasThumbnail,
} from "@/server/services/plansaService";

export type CanvasEditActionResult = { ok: boolean; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Planșa nu mai există.",
  INVALID_STATE: "Planșa nu a putut fi salvată.",
  DETAIL_NOT_FOUND: "Detaliul nu mai există.",
  RATE_LIMITED: "Prea multe salvări. Așteaptă un moment.",
};

function parseDocument(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Autosave document — doar owner-ul.
// SEC-001 (fix 2026-07-13): folosea `auth()` (doar cookie, nu status DB proaspăt) ca excepție de
// performanță — dar un cont suspendat/șters ar fi putut rămâne "activ" pe autosave până la expirarea
// JWT-ului (7 zile), inconsecvent cu restul mutațiilor. Aliniat acum la `requireActiveUserId()`, ca
// peste tot: un cont non-ACTIVE e delogat la PRIMA încercare de autosave, nu doar la alte acțiuni.
export async function saveCanvasDocumentAction(
  canvasId: string,
  documentJson: string,
): Promise<CanvasEditActionResult> {
  const userId = await requireActiveUserId();

  // SEC-01: salvarea scrie în DB la fiecare apel (declanșată des din editor) → limită per user.
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const res = await saveCanvasDocument({
    canvasId,
    ownerId: userId,
    document: parseDocument(documentJson),
  });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut salva." };
  return { ok: true };
}

// Thumbnail incarcat direct in Blob; Server Action primeste numai URL-ul temporar.
export async function saveCanvasThumbnailAction(
  formData: FormData,
): Promise<CanvasEditActionResult> {
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const canvasId = String(formData.get("canvasId") ?? "");
  const thumbnailUrl = String(formData.get("thumbnailUrl") ?? "");
  if (!isUsersBlobUrl(thumbnailUrl, userId) ||
      !new URL(thumbnailUrl).pathname.startsWith(`/u/${userId}/canvases/uploads/`)) {
    return { ok: false, error: "Thumbnail-ul nu a putut fi salvat." };
  }

  // SEC-02: câmpul de fișier e controlat de client → re-encodăm cu sharp (magic bytes + strip + plafon).
  const upload = await reprocessBlobImage(thumbnailUrl, "canvases", userId);
  if (!upload.ok) return { ok: false, error: "Thumbnail-ul nu a putut fi salvat." };

  const res = await saveCanvasThumbnail({
    canvasId,
    ownerId: userId,
    thumbnailUrl: upload.url,
  });
  if (!res.ok) {
    await deleteBlobs([upload.url]); // planșa nu-i a lui / a dispărut → blob orfan, curăță
    return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut salva thumbnail-ul." };
  }
  return { ok: true };
}

// Scoate un detaliu (sau, cu `sketchId`, o schiță) de pe planșă (din acțiunea contextuală a selecției).
// Item-ul îl șterge clientul din document.
export async function removeDetailFromCanvasAction(
  canvasId: string,
  detailId: string,
  sketchId?: string | null,
): Promise<CanvasEditActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await removeDetailFromCanvas({ canvasId, ownerId: userId, detailId, sketchId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut elimina detaliul." };
  return { ok: true };
}
