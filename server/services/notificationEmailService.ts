import { createHash } from "node:crypto";
import { activityEmailHtml, activityEmailText, sendEmail, type ActivityEmailData } from "@/lib/email";
import { notificationHref } from "@/lib/notification-view";
import { createSignedToken, verifySignedToken } from "@/lib/signed-token";
import { isUuid } from "@/server/domain/ids";
import { disableActivityEmails } from "@/server/repos/usersRepo";
import { siteUrl } from "@/lib/site-url";
import {
  claimEmailDeliveries, createDueEmailDeliveries, finishEmailDelivery, getEmailRecipient,
  listDeliverableEmailEvents, retryEmailDelivery, saveEmailSnapshot, type EmailDelivery,
} from "@/server/repos/notificationEmailsRepo";

export const ACTIVITY_UNSUBSCRIBE_PURPOSE = "activity-unsubscribe";
export async function unsubscribeActivityEmails(token: string) {
  const userId = verifySignedToken(ACTIVITY_UNSUBSCRIBE_PURPOSE, token);
  if (!userId || !isUuid(userId)) return false;
  await disableActivityEmails(userId);
  return true;
}
type Events = Awaited<ReturnType<typeof listDeliverableEmailEvents>>;
type Snapshot = { to: string; from: string; subject: string; html: string; text: string; sourceKey: string };
const EMAIL_REQUEST_TIMEOUT_MS = 10_000;

function sourceKey(events: Events): string {
  return createHash("sha256").update(JSON.stringify(events)).digest("hex");
}

function buildEmail(events: Events, userId: string): ActivityEmailData {
  const groups = new Map<string, { title: string; url: string; counts: Map<string, number> }>();
  const labels: Record<string, [string, string]> = {
    SKETCH_PROPOSED: ["schiță nouă", "schițe noi"], SKETCH_DELETED: ["schiță eliminată", "schițe eliminate"],
    COMMENT_ADDED: ["comentariu nou", "comentarii noi"], COMMENT_REPLIED: ["răspuns nou", "răspunsuri noi"],
    MATERIAL_OFFER_SENT: ["ofertă nouă", "oferte noi"], MATERIAL_OFFER_EDITED: ["ofertă actualizată", "oferte actualizate"],
  };
  for (const event of events) {
    const group = groups.get(event.detailId) ?? { title: event.detailTitle,
      url: siteUrl() + (notificationHref(event.payload) ?? `/details/${event.detailId}`), counts: new Map<string, number>() };
    group.counts.set(event.type, (group.counts.get(event.type) ?? 0) + 1);
    groups.set(event.detailId, group);
  }
  return {
    items: [...groups.values()].map((group) => ({ title: group.title, url: group.url,
      events: [...group.counts].map(([type, count]) => `${count} ${labels[type][count === 1 ? 0 : 1]}`) })),
    unsubscribeUrl: `${siteUrl()}/api/activity/unsubscribe?token=${encodeURIComponent(createSignedToken(ACTIVITY_UNSUBSCRIBE_PURPOSE, userId))}`,
  };
}

async function sendDelivery(delivery: EmailDelivery) {
  const [recipient, events] = await Promise.all([
    getEmailRecipient(delivery.recipientUserId), listDeliverableEmailEvents(delivery),
  ]);
  const snapshot = delivery.payloadJson as Snapshot | null;
  if (!recipient || recipient.status !== "ACTIVE" || recipient.mode === "IN_APP" || recipient.mode !== delivery.mode) {
    await finishEmailDelivery(delivery, "CANCELLED", !snapshot && !!recipient && recipient.status === "ACTIVE" && recipient.mode !== "IN_APP");
    return "skipped" as const;
  }
  if (!events.length || (snapshot && (snapshot.to !== recipient.email || snapshot.sourceKey !== sourceKey(events)))) {
    await finishEmailDelivery(delivery, "CANCELLED");
    return "skipped" as const;
  }
  const data = snapshot ? null : buildEmail(events, delivery.recipientUserId);
  const message: Snapshot = snapshot ?? { to: recipient.email, from: process.env.EMAIL_FROM!,
    subject: "Noutăți în discuțiile tale pe DETALIA", html: activityEmailHtml(data!), text: activityEmailText(data!), sourceKey: sourceKey(events) };
  if (!await saveEmailSnapshot(delivery, message, new Date())) return "skipped" as const;
  // Dupa persistarea snapshotului verificam din nou citirea, preferinta si accesul.
  const [currentRecipient, currentEvents] = await Promise.all([
    getEmailRecipient(delivery.recipientUserId), listDeliverableEmailEvents(delivery),
  ]);
  if (currentRecipient?.status !== "ACTIVE" || currentRecipient.mode !== delivery.mode
    || currentRecipient.email !== message.to || sourceKey(currentEvents) !== message.sourceKey) {
    await finishEmailDelivery(delivery, "CANCELLED");
    return "skipped" as const;
  }
  // Timpul curent, dupa toate asteptarile; pastram si marja intregului timeout al cererii.
  if (delivery.firstAttemptAt && Date.now() + EMAIL_REQUEST_TIMEOUT_MS >= new Date(delivery.firstAttemptAt).getTime() + 86_400_000) {
    await finishEmailDelivery(delivery, "FAILED");
    return "failed" as const;
  }
  const sent = await sendEmail({ ...message, idempotencyKey: `notification-delivery/${delivery.id}`, signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS) });
  if (sent) await finishEmailDelivery(delivery, "SENT");
  else await retryEmailDelivery(delivery, new Date());
  return sent ? "sent" as const : "failed" as const;
}

export async function processNotificationEmails(now: Date = new Date()) {
  const result = { claimed: 0, sent: 0, skipped: 0, failed: 0 };
  // Preview nu trimite activitate catre conturi reale; testeaza serviciul fara apeluri de retea.
  if (process.env.NOTIFICATION_EMAILS_ENABLED !== "true" || process.env.VERCEL_ENV !== "production"
    || !process.env.AUTH_RESEND_KEY || !process.env.EMAIL_FROM) return result;
  await createDueEmailDeliveries(now);
  const deliveries = await claimEmailDeliveries(now);
  result.claimed = deliveries.length;
  // Resend limiteaza echipa, inclusiv login-ul: cel mult 5 cereri/secunda din acest procesor.
  for (let i = 0; i < deliveries.length; i += 5) {
    const outcomes = await Promise.allSettled(deliveries.slice(i, i + 5).map((delivery) => sendDelivery(delivery)));
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") result[outcome.value]++;
      else result.failed++; // Lease-ul expira si batch-ul este revendicat ulterior; fara PII in log.
    }
    if (i + 5 < deliveries.length) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return result;
}
