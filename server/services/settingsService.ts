// Service settings — business pentru config-ul global de platformă (single-row).
// Pentru MVP: modul de mentenanță (toggle + dată anunțată + mesaj). Reguli enforce pe SERVER.
import { cache } from "react";

import { getSettingsRow, upsertMaintenance } from "@/server/repos/settingsRepo";

export type MaintenanceState = {
  enabled: boolean;
  date: string | null; // ISO yyyy-mm-dd (data anunțată), sau null
  message: string | null; // mesaj custom opțional
};

const MAX_MESSAGE = 280;

// Citire pe căi fierbinți (landing anonim + banner feed). `cache()` deduplică în cadrul unui request.
// Lipsa rândului → mentenanță OFF (deny-by-default pentru „blocare", aici „nu blocăm").
export const getMaintenanceState = cache(async (): Promise<MaintenanceState> => {
  const row = await getSettingsRow();
  if (!row) return { enabled: false, date: null, message: null };
  return {
    enabled: row.maintenanceEnabled,
    date: row.maintenanceDate,
    message: row.maintenanceMessage,
  };
});

export type SetMaintenanceResult =
  | { ok: true }
  | { ok: false; error: "INVALID_DATE" | "MESSAGE_TOO_LONG" };

// Scrierea config-ului de mentenanță. Callerul (action) garantează deja că e admin (requireAdmin).
// Validăm aici inputul: data în format ISO (yyyy-mm-dd) dacă e dată; mesaj plafonat.
export async function setMaintenance(input: {
  enabled: boolean;
  date: string | null;
  message: string | null;
  adminId: string | null;
}): Promise<SetMaintenanceResult> {
  const date = input.date?.trim() || null;
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "INVALID_DATE" };
  }

  const message = input.message?.trim() || null;
  if (message !== null && message.length > MAX_MESSAGE) {
    return { ok: false, error: "MESSAGE_TOO_LONG" };
  }

  await upsertMaintenance({
    maintenanceEnabled: input.enabled,
    maintenanceDate: date,
    maintenanceMessage: message,
    updatedByAdminId: input.adminId,
  });
  return { ok: true };
}
