// Repo notificări — singurul loc cu acces Drizzle pentru tabelul `notifications` (in-app).
import { and, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotificationType =
  | "SKETCH_PROPOSED"
  | "SKETCH_ACCEPTED"
  | "SKETCH_REJECTED"
  | "SKETCH_DELETED";

export async function insertNotification(input: {
  recipientUserId: string;
  type: NotificationType;
  payloadJson: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(notifications)
    .values({
      recipientUserId: input.recipientUserId,
      type: input.type,
      payloadJson: input.payloadJson,
    })
    .returning();
  return row;
}

export async function listByRecipient(userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

// Marchează citite toate notificările unui user (sau doar una). userId = plasă anti-IDOR în service.
export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
}

// Marchează citită o singură notificare (scoped pe recipient → fără IDOR).
export async function markOneRead(userId: string, id: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt),
      ),
    );
}

// Retenție (cron): șterge notificările CITITE mai vechi de `days`. Necitite rămân (userul trebuie să
// le vadă măcar o dată) — doar cele deja consumate se curăță, ca tabelul să nu crească nemărginit.
export async function deleteReadNotificationsOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const deleted = await db
    .delete(notifications)
    .where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, cutoff)))
    .returning({ id: notifications.id });
  return deleted.length;
}
