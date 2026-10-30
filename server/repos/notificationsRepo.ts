// Repo notificări — singurul loc cu acces Drizzle pentru tabelul `notifications` (in-app).
import { and, desc, eq, exists, isNotNull, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";

import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments, details, notifications, users } from "@/db/schema";
import { ACTIVITY_EMAIL_TYPES } from "@/server/domain/notification";
import { hasProjectAccessForUser } from "@/server/repos/detailsRepo";

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
  | "COMMENT_REPLIED"
  | "APPROVAL_RECEIVED";

export async function insertNotification(input: {
  recipientUserId: string;
  type: NotificationType;
  payloadJson: Record<string, unknown>;
}) {
  const recipientUserId = input.recipientUserId;
  const [row] = await db
    .insert(notifications)
    .values({
      recipientUserId: input.recipientUserId,
      type: input.type,
      payloadJson: input.payloadJson,
      emailDueAt: (ACTIVITY_EMAIL_TYPES as readonly string[]).includes(input.type)
        ? sql`case when exists (select 1 from ${users} where ${users.id} = ${recipientUserId}
            and ${users.status} = 'ACTIVE' and ${users.activityEmailMode} <> 'IN_APP')
            then now() + interval '30 minutes' else null end`
        : null,
    })
    .returning();
  return row;
}

// Istoric grupat de aprobari: acelasi actor nu mareste numarul si nu redeschide notificarea.
export async function upsertApprovalNotification(input: {
  recipientUserId: string; actorId: string; targetType: string; targetId: string;
  detailId: string; detailTitle: string;
}) {
  const payload = { detailId: input.detailId, detailTitle: input.detailTitle, actorIds: [input.actorId],
    ...(input.targetType === "SKETCH" ? { sketchId: input.targetId } : {}) };
  await db.execute(sql`
    insert into ${notifications} (recipient_user_id, type, payload_json, group_key)
    values (${input.recipientUserId}, 'APPROVAL_RECEIVED', ${JSON.stringify(payload)}::jsonb,
      ${`approval/${input.recipientUserId}/${input.targetType}/${input.targetId}`})
    on conflict (group_key) do update set
      payload_json = jsonb_set(${notifications.payloadJson}, '{actorIds}',
        (select jsonb_agg(distinct a.value) from jsonb_array_elements(
          (${notifications.payloadJson}->'actorIds') || jsonb_build_array(${input.actorId}::text)
        ) as a(value))),
      read_at = case when (${notifications.payloadJson}->'actorIds') ? ${input.actorId}
        then ${notifications.readAt} else null end,
      created_at = case when (${notifications.payloadJson}->'actorIds') ? ${input.actorId}
        then ${notifications.createdAt} else now() end
  `);
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
        hasProjectAccessForUser(userId),
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
    // Grupurile de aprobari pastreaza istoricul actorilor pentru idempotenta, inclusiv dupa retentie.
    .where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, cutoff), ne(notifications.type, "APPROVAL_RECEIVED")))
    .returning({ id: notifications.id });
  return deleted.length;
}
