import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { details, notifications, users } from "@/db/schema";
import type { ActivityEmailMode } from "@/server/domain/notification";
import { hasProjectAccessForUser } from "./detailsRepo";

export type EmailDelivery = {
  id: string; recipientUserId: string; mode: ActivityEmailMode; leaseToken: string;
  firstAttemptAt: Date | string | null; payloadJson: unknown;
};

// Un statement: mutex per destinatar, grupare si atasarea evenimentelor la batch.
// IMPORTANT include si evenimentele recente cand primul eveniment al grupului este scadent.
export async function createDueEmailDeliveries(now: Date) {
  const cutoff = new Date(now); cutoff.setUTCHours(7, 0, 0, 0);
  const day = cutoff.toISOString().slice(0, 10);
  await db.execute(sql`
    with recipients as materialized (
      select u.id, u.activity_email_mode as mode from users u
      where u.status = 'ACTIVE' and u.activity_email_mode <> 'IN_APP'
        and exists (select 1 from notifications n where n.recipient_user_id = u.id
          and n.email_due_at is not null and n.email_delivery_id is null and n.read_at is null
          and ((u.activity_email_mode = 'IMPORTANT' and n.email_due_at <= ${now})
            or (u.activity_email_mode = 'DAILY' and ${now}::timestamptz >= ${cutoff}
              and n.created_at <= ${cutoff} and not exists (
                select 1 from notification_email_deliveries e
                where e.period_key = concat('daily/', u.id, '/', ${day}::text)))))
      order by (select min(q.email_due_at) from notifications q where q.recipient_user_id = u.id
        and q.email_delivery_id is null and q.read_at is null and q.email_due_at is not null)
      limit 50 for update skip locked
    ), groups as materialized (
      select gen_random_uuid() as id, n.recipient_user_id, r.mode,
        case when r.mode = 'IMPORTANT' then (n.payload_json->>'detailId')::uuid else null end as detail_id,
        case when r.mode = 'DAILY' then concat('daily/', n.recipient_user_id, '/', ${day}::text) else null end as period_key
      from notifications n join recipients r on r.id = n.recipient_user_id
      where n.email_due_at is not null and n.email_delivery_id is null and n.read_at is null
        and (r.mode = 'IMPORTANT' or n.created_at <= ${cutoff})
      group by n.recipient_user_id, r.mode,
        case when r.mode = 'IMPORTANT' then (n.payload_json->>'detailId')::uuid else null end
      having r.mode = 'DAILY' or min(n.email_due_at) <= ${now}
      order by min(n.email_due_at) limit 50
    ), inserted as (
      insert into notification_email_deliveries (id, recipient_user_id, detail_id, mode, period_key, next_attempt_at)
      select id, recipient_user_id, detail_id, mode, period_key, ${now} from groups
      on conflict (period_key) do nothing returning *
    ), assigned as (
      update notifications n set email_delivery_id = e.id from inserted e
      where n.recipient_user_id = e.recipient_user_id and n.email_due_at is not null
        and n.email_delivery_id is null and n.read_at is null
        and ((e.mode = 'IMPORTANT' and (n.payload_json->>'detailId')::uuid = e.detail_id)
          or (e.mode = 'DAILY' and n.created_at <= ${cutoff})) returning n.id
    ) select count(*) from assigned
  `);
}

export async function claimEmailDeliveries(now: Date): Promise<EmailDelivery[]> {
  const result = await db.execute<EmailDelivery>(sql`
    with due as (
      select id from notification_email_deliveries
      where (status = 'READY' and next_attempt_at <= ${now})
        or (status = 'LEASED' and lease_until <= ${now})
      order by next_attempt_at limit 50 for update skip locked
    ) update notification_email_deliveries d
      set status = 'LEASED', lease_until = ${now}::timestamptz + interval '2 minutes', lease_token = gen_random_uuid()
      from due where d.id = due.id
      returning d.id, d.recipient_user_id as "recipientUserId", d.mode, d.lease_token as "leaseToken",
        d.first_attempt_at as "firstAttemptAt", d.payload_json as "payloadJson"
  `);
  return result.rows;
}

export async function getEmailRecipient(userId: string) {
  const [row] = await db.select({ email: users.email, status: users.status, mode: users.activityEmailMode })
    .from(users).where(eq(users.id, userId));
  return row ?? null;
}

// Aceleasi reguli de vizibilitate, aplicate destinatarului chiar inainte de trimitere.
export async function listDeliverableEmailEvents(delivery: EmailDelivery) {
  return db.select({ id: notifications.id, type: notifications.type, payload: notifications.payloadJson,
    detailId: details.id, detailTitle: details.title })
    .from(notifications)
    .innerJoin(details, sql`${details.id} = (${notifications.payloadJson}->>'detailId')::uuid`)
    .innerJoin(users, eq(users.id, notifications.recipientUserId))
    .where(and(
      eq(notifications.emailDeliveryId, delivery.id), eq(notifications.recipientUserId, delivery.recipientUserId),
      isNull(notifications.readAt), isNotNull(notifications.emailDueAt), eq(users.status, "ACTIVE"),
      eq(users.activityEmailMode, delivery.mode), eq(details.status, "PUBLISHED"),
      hasProjectAccessForUser(delivery.recipientUserId),
      sql`(
        ${notifications.type} = 'SKETCH_DELETED'
        or (${notifications.type} = 'SKETCH_PROPOSED' and exists (
          select 1 from sketches s where s.id = (${sql.identifier("notifications")}.payload_json->>'sketchId')::uuid
            and s.detail_id = ${sql.identifier("details")}.id and s.status = 'PUBLISHED'
            and s.hidden_after_release = false))
        or (${notifications.type} in ('COMMENT_ADDED', 'COMMENT_REPLIED') and exists (
          select 1 from comments c left join comments root on root.id = c.parent_comment_id
          where c.id = (${sql.identifier("notifications")}.payload_json->>'commentId')::uuid
            and c.target_type = 'DETAIL' and c.target_id = ${sql.identifier("details")}.id
            and c.hidden_after_release = false
            and (c.parent_comment_id is null or root.hidden_after_release = false)
            and (c.sketch_context_id is null or exists (select 1 from sketches cs
              where cs.id = c.sketch_context_id and cs.detail_id = ${sql.identifier("details")}.id
                and cs.status = 'PUBLISHED' and cs.hidden_after_release = false))))
        or (${notifications.type} in ('MATERIAL_OFFER_SENT', 'MATERIAL_OFFER_EDITED') and exists (
          select 1 from material_offers o
          where o.id = (${sql.identifier("notifications")}.payload_json->>'offerId')::uuid
            and o.detail_id = ${sql.identifier("details")}.id
            and ${sql.identifier("details")}.author_id = ${delivery.recipientUserId}::uuid
            and ${sql.identifier("details")}.anonymized_at is null))
      )`,
    )).orderBy(asc(notifications.id));
}

export async function saveEmailSnapshot(delivery: EmailDelivery, payload: unknown, now: Date) {
  const result = await db.execute<{ id: string }>(sql`
    update notification_email_deliveries set payload_json = coalesce(payload_json, ${JSON.stringify(payload)}::jsonb),
      first_attempt_at = coalesce(first_attempt_at, ${now}::timestamptz)
    where id = ${delivery.id} and lease_token = ${delivery.leaseToken} and status = 'LEASED' and lease_until > ${now}
    returning id
  `);
  return result.rows.length === 1;
}

export async function finishEmailDelivery(delivery: EmailDelivery, status: "SENT" | "CANCELLED" | "FAILED", requeue = false) {
  await db.execute(sql`
    with finished as (
      update notification_email_deliveries set status = ${status}, lease_until = null, payload_json = null,
        period_key = case when ${requeue} then null else period_key end
      where id = ${delivery.id} and lease_token = ${delivery.leaseToken} and status = 'LEASED' returning id
    ) update notifications set email_due_at = case when ${requeue} then email_due_at else null end,
      email_delivery_id = case when ${requeue} then null else email_delivery_id end
      where email_delivery_id in (select id from finished)
  `);
}

export async function retryEmailDelivery(delivery: EmailDelivery, now: Date) {
  await db.execute(sql`
    update notification_email_deliveries set status = 'READY', lease_until = null,
      next_attempt_at = ${now}::timestamptz + interval '5 minutes'
    where id = ${delivery.id} and lease_token = ${delivery.leaseToken} and status = 'LEASED'
  `);
}

export async function cleanupEmailDeliveries(days: number) {
  await db.execute(sql`delete from notification_email_deliveries
    where status in ('SENT', 'CANCELLED', 'FAILED') and created_at < now() - (${days} * interval '1 day')`);
}
