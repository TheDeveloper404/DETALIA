// Service settings — config-ul global de platformă (single-row). Două controale independente:
//   (1) ANUNȚ programat (banner feed) · (2) LOCKDOWN (platformă închisă pt toți, mai puțin adminul).
import { cache } from "react";

import { getSettingsRow, upsertSettings } from "@/server/repos/settingsRepo";

export type PlatformState = {
  announcement: { enabled: boolean; date: string | null; message: string | null };
  lockdown: { enabled: boolean; message: string | null };
};

const MAX_MESSAGE = 280;

const DEFAULT_STATE: PlatformState = {
  announcement: { enabled: false, date: null, message: null },
  lockdown: { enabled: false, message: null },
};

// Citire pe căi fierbinți (feed, gate-ul de lockdown). `cache()` deduplică în cadrul unui request.
export const getPlatformState = cache(async (): Promise<PlatformState> => {
  const row = await getSettingsRow();
  if (!row) return DEFAULT_STATE;
  return {
    announcement: {
      enabled: row.announcementEnabled,
      date: row.announcementDate,
      message: row.announcementMessage,
    },
    lockdown: { enabled: row.lockdownEnabled, message: row.lockdownMessage },
  };
});

export type SetPlatformResult =
  | { ok: true }
  | { ok: false; error: "INVALID_DATE" | "MESSAGE_TOO_LONG" };

// Scrie ambele controale (formularul din admin le trimite împreună). Callerul garantează sesiunea de admin.
export async function setPlatform(input: {
  announcementEnabled: boolean;
  announcementDate: string | null;
  announcementMessage: string | null;
  lockdownEnabled: boolean;
  lockdownMessage: string | null;
  updatedBy: string | null;
}): Promise<SetPlatformResult> {
  const date = input.announcementDate?.trim() || null;
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "INVALID_DATE" };
  }

  const announcementMessage = input.announcementMessage?.trim() || null;
  const lockdownMessage = input.lockdownMessage?.trim() || null;
  if (
    (announcementMessage && announcementMessage.length > MAX_MESSAGE) ||
    (lockdownMessage && lockdownMessage.length > MAX_MESSAGE)
  ) {
    return { ok: false, error: "MESSAGE_TOO_LONG" };
  }

  await upsertSettings({
    announcementEnabled: input.announcementEnabled,
    announcementDate: date,
    announcementMessage,
    lockdownEnabled: input.lockdownEnabled,
    lockdownMessage,
    updatedBy: input.updatedBy,
  });
  return { ok: true };
}
