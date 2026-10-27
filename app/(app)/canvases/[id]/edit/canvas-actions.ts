"use server";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import {
  removeDetailFromCanvas,
  saveCanvasDocument,
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
