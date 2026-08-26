"use server";

import { auth } from "@/lib/auth";
import { mapNotificationRows } from "@/lib/notification-view";
import type { NotificationView } from "@/components/notification-bell";
import {
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "@/server/services/notificationService";

// Polling simplu (client, la interval fix) — userId din sesiune, fără IDOR. Aceeași sursă de date ca
// randarea inițială din server (app-header.tsx), doar apelabilă repetat din client.
export async function getNotificationsAction(): Promise<{ notifications: NotificationView[]; count: number }> {
  const session = await auth();
  if (!session?.user?.id) return { notifications: [], count: 0 };
  const rows = await getNotifications(session.user.id);
  const notifications = mapNotificationRows(rows);
  return { notifications, count: notifications.filter((n) => n.unread).length };
}

// Marchează citite toate notificările userului din sesiune (la vizitarea paginii). Fără IDOR (userId din sesiune).
export async function markReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await markNotificationsRead(session.user.id);
}

// Marchează citită o singură notificare (la clic pe rând). Scoped pe userul din sesiune → fără IDOR.
export async function markOneReadAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await markNotificationRead(session.user.id, id);
}
