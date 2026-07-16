// Service Notificări — in-app (sursa principală) + email best-effort (Edi le vrea de la început).
// Notificările in-app se scriu mereu; emailul se trimite dacă există credențiale (altfel no-op).

import {
  plainSubject,
  sendEmail,
  sketchDeletedEmailHtml,
  sketchDeletedEmailText,
  sketchProposedEmailHtml,
  sketchProposedEmailText,
  supplierOfferedEmailHtml,
  supplierOfferedEmailText,
} from "@/lib/email";
import {
  deleteReadNotificationsOlderThan,
  insertNotification,
  listByRecipient,
  markAllRead,
  markOneRead,
  type NotificationType,
} from "@/server/repos/notificationsRepo";
import { getUserContact } from "@/server/repos/usersRepo";

function detailUrl(detailId: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base}/details/${detailId}`;
}

// Emailurile de notificare sunt OPRITE implicit (decizie Liviu 2026-07-03): notificarea in-app ajunge,
// iar cota Resend free (100/zi) rămâne pentru magic link-uri (login/signup + admin), unde emailul e
// singura cale de acces. Reversibil fără cod: NOTIFICATION_EMAILS_ENABLED=true în env le repornește
// (motivul inițial „in-app + email pentru brand awareness" rămâne valabil când cota nu mai e o limită).
const EMAILS_ENABLED = process.env.NOTIFICATION_EMAILS_ENABLED === "true";

// Helper intern: notificare in-app + (opțional, vezi mai sus) email.
async function notify(input: {
  recipientUserId: string;
  type: NotificationType;
  payloadJson: Record<string, unknown>;
  emailSubject: string;
  emailHtml: string;
  emailText: string;
}) {
  await insertNotification({
    recipientUserId: input.recipientUserId,
    type: input.type,
    payloadJson: input.payloadJson,
  });
  if (!EMAILS_ENABLED) return;
  const contact = await getUserContact(input.recipientUserId);
  if (contact?.email) {
    await sendEmail({
      to: contact.email,
      subject: input.emailSubject,
      html: input.emailHtml,
      text: input.emailText,
    });
  }
}

// ── Citiri (UI: clopoțel + pagină) ───────────────────────────────────────────
export function getNotifications(userId: string) {
  return listByRecipient(userId);
}

// Marchează citite toate notificările userului (la vizitarea paginii). userId din sesiune = anti-IDOR.
export function markNotificationsRead(userId: string) {
  return markAllRead(userId);
}

export function markNotificationRead(userId: string, id: string) {
  return markOneRead(userId, id);
}

// Către autorul detaliului-mamă: cineva a publicat o schiță peste detaliul lui (intră direct în teanc).
export async function notifySketchProposed(input: {
  recipientUserId: string;
  sketchId: string;
  detailId: string;
  detailTitle: string;
  sketchAuthorName: string | null;
  sketchAuthorRole?: string | null;
  sketchAuthorSubRole?: string | null;
  sketchAuthorVerified?: boolean;
}) {
  const who = input.sketchAuthorName ?? "Cineva";
  const url = detailUrl(input.detailId);
  await notify({
    recipientUserId: input.recipientUserId,
    type: "SKETCH_PROPOSED",
    payloadJson: {
      sketchId: input.sketchId,
      detailId: input.detailId,
      detailTitle: input.detailTitle,
      sketchAuthorName: input.sketchAuthorName,
      sketchAuthorRole: input.sketchAuthorRole ?? null,
      sketchAuthorSubRole: input.sketchAuthorSubRole ?? null,
      sketchAuthorVerified: input.sketchAuthorVerified ?? false,
    },
    emailSubject: plainSubject(`${who} a schițat peste „${input.detailTitle}"`),
    emailHtml: sketchProposedEmailHtml(who, input.detailTitle, url),
    emailText: sketchProposedEmailText(who, input.detailTitle, url),
  });
}

// Către autorul schiței: autorul detaliului-mamă i-a șters schița (moderare post-publicare).
export async function notifySketchDeleted(input: {
  recipientUserId: string;
  detailId: string;
  detailTitle: string;
}) {
  const url = detailUrl(input.detailId);
  await notify({
    recipientUserId: input.recipientUserId,
    type: "SKETCH_DELETED",
    payloadJson: {
      detailId: input.detailId,
      detailTitle: input.detailTitle,
    },
    emailSubject: plainSubject(`Schița ta la „${input.detailTitle}" a fost eliminată`),
    emailHtml: sketchDeletedEmailHtml(input.detailTitle, url),
    emailText: sketchDeletedEmailText(input.detailTitle, url),
  });
}

// Către autorul detaliului: un Furnizor a ridicat mâna (doar la primul click — vezi supplierOfferService).
export async function notifySupplierOffered(input: {
  recipientUserId: string;
  detailId: string;
  detailTitle: string;
  supplierName: string | null;
}) {
  const who = input.supplierName ?? "Un furnizor";
  const url = detailUrl(input.detailId);
  await notify({
    recipientUserId: input.recipientUserId,
    type: "SUPPLIER_OFFERED",
    payloadJson: {
      detailId: input.detailId,
      detailTitle: input.detailTitle,
      supplierName: input.supplierName,
    },
    emailSubject: plainSubject(`${who} poate oferta materiale pentru „${input.detailTitle}"`),
    emailHtml: supplierOfferedEmailHtml(who, input.detailTitle, url),
    emailText: supplierOfferedEmailText(who, input.detailTitle, url),
  });
}

// Retenție (cron, vezi app/api/cron/cleanup-notifications): șterge notificările CITITE mai vechi de
// `retentionDays` — cele necitite rămân (userul trebuie să le vadă măcar o dată).
export async function cleanupOldNotifications(retentionDays: number): Promise<number> {
  return deleteReadNotificationsOlderThan(retentionDays);
}
