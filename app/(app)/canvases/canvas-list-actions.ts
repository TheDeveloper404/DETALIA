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

// Redenumește o planșă (din „Planșele mele"). Form action (useActionState) → revalidate.
// Semnătura (prevState, formData) e cerută de useActionState — 2026-08-07, fix code-review: înainte
// întorcea `void`, iar un eșec (`NOT_FOUND`/`INVALID_NAME`) dispărea silențios, fără feedback în UI.
export async function renameCanvasAction(
  _prevState: CanvasActionResult,
  formData: FormData,
): Promise<CanvasActionResult> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await renameCanvas({ canvasId, ownerId: userId, name });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut redenumi planșa." };
  revalidatePath("/canvases");
  return { ok: true };
}

// Duplică o planșă (din „Planșele mele"). Apelată direct din client (nu `<form action>`) → revalidate;
// copia apare în listă.
export async function duplicateCanvasAction(formData: FormData): Promise<CanvasActionResult> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await duplicateCanvas({ canvasId, ownerId: userId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut duplica planșa." };
  revalidatePath("/canvases");
  return { ok: true };
}

// Șterge o planșă (din „Planșele mele"). Form action (useActionState) → revalidate.
export async function deleteCanvasAction(
  _prevState: CanvasActionResult,
  formData: FormData,
): Promise<CanvasActionResult> {
  const userId = await requireActiveUserId();
  const canvasId = String(formData.get("canvasId") ?? "");
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }
  const res = await deleteCanvas({ canvasId, ownerId: userId });
  if (!res.ok) return { ok: false, error: ERROR_MESSAGES[res.error] ?? "Nu am putut șterge planșa." };
  revalidatePath("/canvases");
  return { ok: true };
}
