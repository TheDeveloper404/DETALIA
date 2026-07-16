// Repo platform_settings — singura zonă cu acces Drizzle pe tabelul SINGLE-ROW de config global.
// Modelul: există cel mult un rând. Citirea întoarce rândul sau null (defaults în service).
// Scrierea face upsert pe rândul existent (sau inserează primul).
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { reportServerException } from "@/lib/posthog-report";

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;

// Citire TOLERANTĂ la erori: tabelul de config e citit pe căi critice (landing, gate-ul de lockdown din
// proxy) → o problemă de DB (drift de schemă, tabel lipsă, outage) NU trebuie să dărâme paginile.
// La eroare logăm și întoarcem null → service-ul cade pe default (mentenanță OFF), site-ul rămâne funcțional.
// Raportarea către PostHog folosește `reportServerException` (fetch brut), NU `getPostHogClient()`
// (posthog-node) — acest repo e importat de `proxy.ts`, care rulează pe Edge; SDK-ul Node ar sparge
// gate-ul de mentenanță pentru TOT traficul (bug găsit 2026-07-16, code review).
export async function getSettingsRow(): Promise<PlatformSettingsRow | null> {
  try {
    const [row] = await db.select().from(platformSettings).limit(1);
    return row ?? null;
  } catch (err) {
    // `err.message` la erorile Drizzle e doar wrapper-ul ("Failed query: ...") — cauza reală
    // (ex. connection refused, too many clients) stă pe `.cause`, altfel nu se poate diagnostica
    // recurența intermitentă din producție (apărută în zile diferite, fără pattern clar din log).
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    console.error(
      "platform_settings: citire eșuată (drift de schemă / outage?) — cad pe default:",
      err instanceof Error ? err.message : String(err),
      cause ? `cause: ${cause}` : "",
    );
    reportServerException(err, { area: "platform_settings" });
    return null;
  }
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
