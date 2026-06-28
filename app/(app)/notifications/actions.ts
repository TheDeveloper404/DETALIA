"use server";

import { auth } from "@/lib/auth";
import {
  markNotificationRead,
  markNotificationsRead,
} from "@/server/services/notificationService";

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
