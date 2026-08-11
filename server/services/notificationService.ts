// Service Notificări — in-app (sursa principală) + email best-effort (cerut de la început).
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
import { listProjectIdForDetails } from "@/server/repos/detailsRepo";
import { getUserContact } from "@/server/repos/usersRepo";
import { isUuid } from "@/server/domain/ids";
import { getProjectAccess } from "@/server/services/projectService";

function detailUrl(detailId: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base}/details/${detailId}`;
}

// Emailurile de notificare sunt OPRITE implicit (decizie de produs 2026-07-03): notificarea in-app ajunge,
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

const HIDDEN_TITLE = "un detaliu la care nu mai ai acces";

// SEC-011 (audit securitate 2026-08-11): notificarea deja livrată păstra titlul detaliului în
// payload — un membru eliminat dintr-un proiect continua să vadă titlul unui detaliu privat în
// clopoțel (linkul dădea deja 404, dar titlul rămânea). Scrub la CITIRE, nu la eliminare (accesul se
// poate pierde/recâștiga oricând, nu doar la removeMember — mai simplu și mai robust decât un hook
// separat pe fiecare cale care poate revoca accesul).
async function scrubDetailTitles(userId: string, rows: Awaited<ReturnType<typeof listByRecipient>>) {
  const detailIds = [
    ...new Set(
      rows
        .map((r) => (r.payloadJson as { detailId?: unknown })?.detailId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  if (detailIds.length === 0) return rows;

  const projectIdByDetail = await listProjectIdForDetails(detailIds);
  const projectIds = [...new Set([...projectIdByDetail.values()].filter((p): p is string => !!p))];
  if (projectIds.length === 0) return rows;

  const accessByProject = new Map(
    await Promise.all(
      projectIds.map(
        async (projectId) => [projectId, (await getProjectAccess({ projectId, userId })).hasAccess] as const,
      ),
    ),
  );

  return rows.map((r) => {
    const detailId = (r.payloadJson as { detailId?: unknown })?.detailId;
    if (typeof detailId !== "string") return r;
    const projectId = projectIdByDetail.get(detailId);
    if (!projectId || accessByProject.get(projectId)) return r;
    return { ...r, payloadJson: { ...(r.payloadJson as object), detailTitle: HIDDEN_TITLE } };
  });
}

// ── Citiri (UI: clopoțel + pagină) ───────────────────────────────────────────
export async function getNotifications(userId: string) {
  const rows = await listByRecipient(userId);
  return scrubDetailTitles(userId, rows);
}

// Marchează citite toate notificările userului (la vizitarea paginii). userId din sesiune = anti-IDOR.
export function markNotificationsRead(userId: string) {
  return markAllRead(userId);
}

export async function markNotificationRead(userId: string, id: string) {
  // SEC-006: gardă isUuid (SEC-11), lipsea aici — id malformat cade direct în cast Postgres, altfel.
  if (!isUuid(id)) return;
  await markOneRead(userId, id);
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
