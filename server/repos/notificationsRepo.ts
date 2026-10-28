// Repo notificări — singurul loc cu acces Drizzle pentru tabelul `notifications` (in-app).
import { and, desc, eq, exists, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";

import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments, details, notifications, projectMembers, projects } from "@/db/schema";

export type NotificationType =
  | "SKETCH_PROPOSED"
  | "SKETCH_ACCEPTED"
  | "SKETCH_REJECTED"
  | "SKETCH_DELETED"
  | "SUPPLIER_OFFERED"
  | "MATERIAL_OFFER_SENT"
  | "MATERIAL_OFFER_EDITED"
  | "REFERRAL_JOINED"
  | "COMMENT_ADDED"
  | "COMMENT_REPLIED";

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
  const root = alias(comments, "notification_root");
  const visibleComment = db
    .select({ id: comments.id })
    .from(comments)
    .leftJoin(root, eq(root.id, comments.parentCommentId))
    .innerJoin(details, and(eq(comments.targetType, "DETAIL"), eq(details.id, comments.targetId)))
    .where(
      and(
        eq(comments.id, sql`(${notifications.payloadJson}->>'commentId')::uuid`),
        eq(details.id, sql`(${notifications.payloadJson}->>'detailId')::uuid`),
        eq(comments.hiddenAfterRelease, false),
        or(isNull(comments.parentCommentId), eq(root.hiddenAfterRelease, false)),
        eq(details.status, "PUBLISHED"),
        or(
          isNull(details.projectId),
          exists(
            db
              .select({ id: projects.id })
              .from(projects)
              .where(
                and(
                  eq(projects.id, details.projectId),
                  or(
                    eq(projects.ownerId, userId),
                    exists(
                      db
                        .select({ id: projectMembers.id })
                        .from(projectMembers)
                        .where(
                          and(
                            eq(projectMembers.projectId, projects.id),
                            eq(projectMembers.userId, userId),
                            isNull(projectMembers.removedAt),
                          ),
                        ),
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    );
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        or(
          notInArray(notifications.type, ["COMMENT_ADDED", "COMMENT_REPLIED"]),
          exists(visibleComment),
        ),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
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
