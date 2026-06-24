// Service Notificări — in-app (sursa principală) + email best-effort (Edi le vrea de la început).
// Notificările in-app se scriu mereu; emailul se trimite dacă există credențiale (altfel no-op).

import { sendEmail } from "@/lib/email";
import {
  countUnread,
  insertNotification,
  listByRecipient,
  markAllRead,
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

// Către autorul detaliului-mamă: cineva a propus o schiță (SEND).
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
    emailSubject: plain(`${who} a propus o modificare la „${input.detailTitle}"`),
    emailHtml: `<p>${esc(who)} a propus o schiță la detaliul tău <strong>${esc(input.detailTitle)}</strong>.</p>
      <p><a href="${esc(url)}">Vizualizează și acceptă sau respinge →</a></p>`,
  });
}

// Către autorul schiței: schița a fost acceptată (PUBLISHED) sau respinsă (REJECTED).
export async function notifySketchDecision(input: {
  recipientUserId: string;
  sketchId: string;
  detailId: string;
  detailTitle: string;
  accepted: boolean;
}) {
  const url = detailUrl(input.detailId);
  const verb = input.accepted ? "acceptată" : "respinsă";
  await notify({
    recipientUserId: input.recipientUserId,
    type: input.accepted ? "SKETCH_ACCEPTED" : "SKETCH_REJECTED",
    payloadJson: {
      sketchId: input.sketchId,
      detailId: input.detailId,
      detailTitle: input.detailTitle,
    },
    emailSubject: plain(`Schița ta la „${input.detailTitle}" a fost ${verb}`),
    emailHtml: `<p>Schița ta la detaliul <strong>${esc(input.detailTitle)}</strong> a fost <strong>${verb}</strong>.</p>
      <p><a href="${esc(url)}">Vezi detaliul →</a></p>`,
  });
}
