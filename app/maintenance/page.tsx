import { MaintenanceScreen } from "@/components/maintenance-screen";
import { getPlatformState } from "@/server/services/settingsService";

// Ecranul „site în lucru". Servit prin REWRITE din proxy când lockdown e activ (URL-ul rămâne cel cerut).
// Public (vezi PUBLIC_PATHS). Dacă cineva ajunge aici fără lockdown, e doar un ecran static inofensiv.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { lockdown, announcement } = await getPlatformState();
  return <MaintenanceScreen message={lockdown.message} date={announcement.date} />;
}
