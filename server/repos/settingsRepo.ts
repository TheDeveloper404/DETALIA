// Repo platform_settings — singura zonă cu acces Drizzle pe tabelul SINGLE-ROW de config global.
// Modelul: există cel mult un rând. Citirea întoarce rândul sau null (defaults în service).
// Scrierea face upsert pe rândul existent (sau inserează primul).
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;

export async function getSettingsRow(): Promise<PlatformSettingsRow | null> {
  const [row] = await db.select().from(platformSettings).limit(1);
  return row ?? null;
}

// Upsert pe rândul singleton: dacă există, UPDATE; altfel INSERT primul rând.
export async function upsertSettings(fields: {
  announcementEnabled: boolean;
  announcementDate: string | null;
  announcementMessage: string | null;
  lockdownEnabled: boolean;
  lockdownMessage: string | null;
  updatedBy: string | null;
}): Promise<void> {
  const existing = await getSettingsRow();
  if (existing) {
    await db
      .update(platformSettings)
      .set(fields)
      .where(eq(platformSettings.id, existing.id));
    return;
  }
  await db.insert(platformSettings).values(fields);
}
