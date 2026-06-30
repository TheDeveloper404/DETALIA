"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { destroyAdminSession, getAdminSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { checkLimit, hashAuditId, limiters } from "@/lib/rate-limit";
import { setMaintenance } from "@/server/services/settingsService";

export type MaintenanceFormState = { ok: boolean; error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Sesiune de admin expirată. Autentifică-te din nou.",
  INVALID_DATE: "Data nu e validă.",
  MESSAGE_TOO_LONG: "Mesajul e prea lung (max 280 caractere).",
  RATE_LIMITED: "Prea multe modificări într-un timp scurt. Așteaptă un moment.",
};

// Salvează config-ul de mentenanță. Authz: sesiune de admin (deny-by-default). Enforce pe SERVER.
export async function setMaintenanceAction(
  _prev: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  const admin = await getAdminSession();
  if (!admin) {
    return { ok: false, error: ERROR_MESSAGES.FORBIDDEN };
  }

  // Rate-limit per admin (defense-in-depth).
  if (!(await checkLimit(limiters.mutation, admin.email)).ok) {
    return { ok: false, error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const enabled = formData.get("enabled") === "on";
  const date = typeof formData.get("date") === "string" ? (formData.get("date") as string) : null;
  const message =
    typeof formData.get("message") === "string" ? (formData.get("message") as string) : null;

  const result = await setMaintenance({ enabled, date, message, updatedBy: admin.email });
  if (!result.ok) {
    return { ok: false, error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers." };
  }

  // SEC-14: acțiune administrativă cu impact global → audit (cine + ce). emailHash, fără PII brut.
  audit("maintenance_toggled", { emailHash: hashAuditId(admin.email), enabled, hasDate: !!date }, "warning");

  // Reflectă imediat schimbarea pe landing + feed (citesc starea de mentenanță).
  revalidatePath("/", "layout");
  return { ok: true, error: null };
}

// Logout admin — distruge sesiunea și revine la login.
export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin-page/login");
}
