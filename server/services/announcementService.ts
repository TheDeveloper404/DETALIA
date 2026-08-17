import {
  ANNOUNCEMENT_ITEMS,
  CURRENT_ANNOUNCEMENT_VERSION,
  type AnnouncementItem,
} from "@/server/domain/announcements";
import { getLastSeenAnnouncement, updateLastSeenAnnouncement } from "@/server/repos/usersRepo";

// Panoul „Ce e nou" — apare o singură dată per versiune, la prima vizită după ce a apărut conținut nou.
// Întoarce `null` dacă userul a văzut deja versiunea curentă (nimic de arătat).
export async function getUnseenAnnouncement(userId: string): Promise<AnnouncementItem[] | null> {
  const lastSeen = await getLastSeenAnnouncement(userId);
  if (lastSeen === CURRENT_ANNOUNCEMENT_VERSION) return null;
  return ANNOUNCEMENT_ITEMS;
}

// Marchează versiunea curentă ca văzută — userId din sesiune (anti-IDOR), niciodată din client.
export async function markAnnouncementSeen(userId: string): Promise<void> {
  await updateLastSeenAnnouncement(userId, CURRENT_ANNOUNCEMENT_VERSION);
}
