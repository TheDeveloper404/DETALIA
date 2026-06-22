"use server";

import { auth } from "@/lib/auth";
import { markNotificationsRead } from "@/server/services/notificationService";

// Marchează citite toate notificările userului din sesiune (la vizitarea paginii). Fără IDOR (userId din sesiune).
export async function markReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await markNotificationsRead(session.user.id);
}
