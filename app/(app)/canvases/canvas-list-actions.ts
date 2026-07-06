"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import {
  addDetailToCanvas,
  createCanvas,
  deleteCanvas,
  duplicateCanvas,
  listMyCanvases,
  renameCanvas,
} from "@/server/services/plansaService";

export type CanvasActionResult = { ok: boolean; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Planșa nu mai există.",
  INVALID_NAME: "Dă un nume planșei (max 80 de caractere).",
  INVALID_STATE: "Planșa nu a putut fi salvată.",
  LIMIT_REACHED: "Planșa a atins limita de detalii.",
  DETAIL_NOT_FOUND: "Detaliul nu mai există.",
  RATE_LIMITED: "Prea multe acțiuni. Așteaptă un moment.",
};

// READ (lazy) pentru popover-ul „Trimite în Planșă": lista planșelor mele (id + nume). Nu mută nimic.
export async function getMyCanvasesForPicker(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const list = await listMyCanvases(session.user.id);
  return list.map((c) => ({ id: c.id, name: c.name }));
}

// Creează o planșă goală. Întoarce canvasId (pt navigare opțională). Folosit din „Planșele mele".
export async function createCanvasAction(name: string): Promise<CanvasActionResult & { canvasId?: string }> {
  const userId = await requireActiveUserId(); // SEC-04: creare de conținut
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await createCanvas({ ownerId: userId, name });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut crea planșa." };
  revalidatePath("/canvases");
  return { ok: true, canvasId: res.value.canvasId };
}

// Adaugă un detaliu (sau, cu `sketchId`, schița desenată peste el) într-o planșă existentă (din
// popover-ul feed/detaliu). NU navighează.
export async function addDetailToCanvasAction(
  canvasId: string,
  detailId: string,
  sketchId?: string | null,
): Promise<CanvasActionResult> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await addDetailToCanvas({ canvasId, ownerId: userId, detailId, sketchId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut adăuga detaliul." };
  return { ok: true };
}

// Creează o planșă nouă ȘI adaugă detaliul/schița în ea (varianta inline „+ Creează planșă nouă" din popover).
export async function createCanvasAndAddDetailAction(
  name: string,
  detailId: string,
  sketchId?: string | null,
): Promise<CanvasActionResult & { canvasId?: string }> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const created = await createCanvas({ ownerId: userId, name });
  if (!created.ok) {
    return { ok: false, error: ERROR_MESSAGES[created.error] ?? "Nu am putut crea planșa." };
  }
  const added = await addDetailToCanvas({
    canvasId: created.value.canvasId,
    ownerId: userId,
    detailId,
    sketchId,
  });
  if (!added.ok) {
    return { ok: false, error: ERROR_MESSAGES[added.error] ?? "Planșa a fost creată, dar detaliul nu s-a adăugat." };
  }
  revalidatePath("/canvases");
  return { ok: true, canvasId: created.value.canvasId };
}

// Redenumește o planșă (din „Planșele mele"). Form action → revalidate.
export async function renameCanvasAction(formData: FormData): Promise<void> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) redirect("/canvases");
  await renameCanvas({ canvasId, ownerId: userId, name });
  revalidatePath("/canvases");
}

// Duplică o planșă (din „Planșele mele"). Form action → revalidate; copia apare în listă.
export async function duplicateCanvasAction(formData: FormData): Promise<void> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) redirect("/canvases");
  await duplicateCanvas({ canvasId, ownerId: userId });
  revalidatePath("/canvases");
}

// Șterge o planșă (din „Planșele mele"). Form action → revalidate.
export async function deleteCanvasAction(formData: FormData): Promise<void> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) redirect("/canvases");
  await deleteCanvas({ canvasId, ownerId: userId });
  revalidatePath("/canvases");
}
