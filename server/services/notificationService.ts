// Service Notificări — in-app (sursa principală) + email best-effort (Edi le vrea de la început).
// Notificările in-app se scriu mereu; emailul se trimite dacă există credențiale (altfel no-op).

import { sendEmail } from "@/lib/email";
import {
  countUnread,
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

// Escape HTML — valorile controlate de user (titlu, nume) NU intră brut în HTML-ul de email (anti-XSS).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Subiect = text simplu: fără HTML, dar curățăm newline-uri (anti header-injection).
function plain(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

// Helper intern: notificare in-app + email (dacă avem contactul + credențiale).
async function notify(input: {
  recipientUserId: string;
  type: NotificationType;
  payloadJson: Record<string, unknown>;
  emailSubject: string;
  emailHtml: string;
}) {
  await insertNotification({
    recipientUserId: input.recipientUserId,
    type: input.type,
    payloadJson: input.payloadJson,
  });
  const contact = await getUserContact(input.recipientUserId);
  if (contact?.email) {
    await sendEmail({ to: contact.email, subject: input.emailSubject, html: input.emailHtml });
  }
}

// ── Citiri (UI: clopoțel + pagină) ───────────────────────────────────────────
export function getNotifications(userId: string) {
  return listByRecipient(userId);
}

export function getUnreadCount(userId: string) {
  return countUnread(userId);
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
      sketchAuthorVerified: input.sketchAuthorVerified ?? false,
    },
    emailSubject: plain(`${who} a schițat peste „${input.detailTitle}"`),
    emailHtml: `<p>${esc(who)} a publicat o schiță peste detaliul tău <strong>${esc(input.detailTitle)}</strong>.</p>
      <p><a href="${esc(url)}">Vezi schița în teanc →</a></p>`,
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
    emailSubject: plain(`Schița ta la „${input.detailTitle}" a fost eliminată`),
    emailHtml: `<p>Schița ta de la detaliul <strong>${esc(input.detailTitle)}</strong> a fost eliminată de autorul detaliului.</p>
      <p><a href="${esc(url)}">Vezi detaliul →</a></p>`,
  });
}
