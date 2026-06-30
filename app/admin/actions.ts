"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { setMaintenance } from "@/server/services/settingsService";

export type MaintenanceFormState = { ok: boolean; error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Nu ai permisiunea necesară.",
  INVALID_DATE: "Data nu e validă.",
  MESSAGE_TOO_LONG: "Mesajul e prea lung (max 280 caractere).",
};

// Salvează config-ul de mentenanță. Authz: requireAdmin (deny-by-default, allowlist ADMIN_EMAILS).
// Enforce pe SERVER — formularul nu e sursa de adevăr.
export async function setMaintenanceAction(
  _prev: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  let adminId: string | null = null;
  try {
    const session = await requireAdmin();
    adminId = session.user?.id ?? null;
  } catch {
    return { ok: false, error: ERROR_MESSAGES.FORBIDDEN };
  }

  const enabled = formData.get("enabled") === "on";
  const date = typeof formData.get("date") === "string" ? (formData.get("date") as string) : null;
  const message =
    typeof formData.get("message") === "string" ? (formData.get("message") as string) : null;

  const result = await setMaintenance({ enabled, date, message, adminId });
  if (!result.ok) {
    return { ok: false, error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers." };
  }

  // Reflectă imediat schimbarea pe landing + feed (citesc starea de mentenanță).
  revalidatePath("/", "layout");
  return { ok: true, error: null };
}
