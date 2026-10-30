// Notificari in-app si eligibilitatea pentru emailurile grupate din coada persistenta.

import {
  deleteReadNotificationsOlderThan,
  insertNotification,
  listByRecipient,
  markAllRead,
  markOneRead,
  type NotificationType,
  upsertApprovalNotification,
} from "@/server/repos/notificationsRepo";
import { getThreadCommentForTarget } from "@/server/repos/commentsRepo";
import type { TargetType } from "@/server/domain/validation";
import { getDetailById, listProjectIdForDetails } from "@/server/repos/detailsRepo";
import { getSketchById } from "@/server/repos/sketchesRepo";
import { isUuid } from "@/server/domain/ids";
import { canAccessProjectDetail, getProjectAccess } from "@/server/services/projectService";
import { cleanupEmailDeliveries } from "@/server/repos/notificationEmailsRepo";

// Notificarea si scadenta emailului se scriu atomic in repo; trimiterea este doar prin cron.
async function notify(input: {
  recipientUserId: string;
  type: NotificationType;
  payloadJson: Record<string, unknown>;
}) {
  await insertNotification(input);
}

const HIDDEN_TITLE = "un detaliu la care nu mai ai acces";

// SEC-011 (audit securitate 2026-08-11): notificarea deja livrată păstra titlul detaliului în
// payload — un membru eliminat dintr-un proiect continua să vadă titlul unui detaliu privat în
// clopoțel (linkul dădea deja 404, dar titlul rămânea). Scrub la CITIRE, nu la eliminare (accesul se
// poate pierde/recâștiga oricând, nu doar la removeMember — mai simplu și mai robust decât un hook
// separat pe fiecare cale care poate revoca accesul).
async function scrubDetailTitles(
  userId: string,
  rows: Awaited<ReturnType<typeof listByRecipient>>,
) {
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
        async (projectId) =>
          [projectId, (await getProjectAccess({ projectId, userId })).hasAccess] as const,
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
  });
}

// Către autorul schiței: autorul detaliului-mamă i-a șters schița (moderare post-publicare).
export async function notifySketchDeleted(input: {
  recipientUserId: string;
  detailId: string;
  detailTitle: string;
}) {
  await notify({
    recipientUserId: input.recipientUserId,
    type: "SKETCH_DELETED",
    payloadJson: {
      detailId: input.detailId,
      detailTitle: input.detailTitle,
    },
  });
}

export async function notifyMaterialOfferSent(input: {
  recipientUserId: string;
  detailId: string;
  detailTitle: string;
  supplierName: string | null;
  offerId?: string;
}) {
  await notify({
    recipientUserId: input.recipientUserId,
    type: "MATERIAL_OFFER_SENT",
    payloadJson: {
      detailId: input.detailId,
      detailTitle: input.detailTitle,
      supplierName: input.supplierName,
      ...(input.offerId ? { offerId: input.offerId } : {}),
    },
  });
}

export async function notifyMaterialOfferEdited(input: {
  recipientUserId: string;
  detailId: string;
  detailTitle: string;
  supplierName: string | null;
  offerId?: string;
}) {
  await notify({
    recipientUserId: input.recipientUserId,
    type: "MATERIAL_OFFER_EDITED",
    payloadJson: {
      detailId: input.detailId,
      detailTitle: input.detailTitle,
      supplierName: input.supplierName,
      ...(input.offerId ? { offerId: input.offerId } : {}),
    },
  });
}

export async function notifyReferralJoined(input: {
  recipientUserId: string;
  joinedUserId: string;
  joinedUserName: string | null;
}) {
  await notify({
    recipientUserId: input.recipientUserId,
    type: "REFERRAL_JOINED",
    payloadJson: { joinedUserId: input.joinedUserId, joinedUserName: input.joinedUserName },
  });
}

// Retenție (cron, vezi app/api/cron/cleanup-notifications): șterge notificările CITITE mai vechi de
// `retentionDays` — cele necitite rămân (userul trebuie să le vadă măcar o dată).
export async function cleanupOldNotifications(retentionDays: number): Promise<number> {
  await cleanupEmailDeliveries(retentionDays);
  return deleteReadNotificationsOlderThan(retentionDays);
}

export async function notifyCommentAdded(input: {
  actorId: string;
  targetType: TargetType;
  targetId: string;
  commentId: string;
  parentCommentId: string | null;
  replyToCommentId: string | null;
  // Dezaprobarea unei schite: justificarea e pe detaliu, dar o primeste si autorul schitei.
  sketchContextId?: string | null;
}) {
  if (input.targetType !== "DETAIL") return;
  const detail = await getDetailById(input.targetId);
  if (!detail) return;
  const recipients = new Set<string>();
  // Autorul care s-a retras de pe continut nu mai primeste notificari despre el.
  if (!detail.isAnonymized) recipients.add(detail.ownerId);
  const sketch = input.sketchContextId ? await getSketchById(input.sketchContextId) : null;
  const sketchId = sketch?.detailId === detail.id ? sketch.id : null;
  if (sketch && sketchId && !sketch.authorRemoved) recipients.add(sketch.authorId);
  for (const id of new Set([input.parentCommentId, input.replyToCommentId])) {
    if (!id) continue;
    const comment = await getThreadCommentForTarget(id, input.targetType, input.targetId);
    if (comment) recipients.add(comment.authorId);
  }
  recipients.delete(input.actorId);
  const allowed = await Promise.all(
    [...recipients].map(async (userId) =>
      !detail.projectId || (await canAccessProjectDetail({ projectId: detail.projectId, userId }))
        ? userId
        : null,
    ),
  );
  await Promise.all(
    allowed
      .filter((userId): userId is string => !!userId)
      .map((recipientUserId) =>
        insertNotification({
          recipientUserId,
          type: input.parentCommentId ? "COMMENT_REPLIED" : "COMMENT_ADDED",
          payloadJson: {
            detailId: detail.id,
            detailTitle: detail.title,
            commentId: input.commentId,
            ...(sketchId ? { sketchId } : {}),
          },
        }),
      ),
  );
}

export async function notifyApprovalReceived(input: { actorId: string; targetType: TargetType; targetId: string }) {
  const sketch = input.targetType === "SKETCH" ? await getSketchById(input.targetId) : null;
  if (input.targetType === "SKETCH" && (!sketch || sketch.status !== "PUBLISHED" || sketch.hiddenAfterRelease || sketch.authorRemoved)) return;
  const detail = await getDetailById(sketch?.detailId ?? input.targetId);
  if (!detail || (!sketch && detail.isAnonymized)) return;
  const recipientUserId = sketch?.authorId ?? detail.ownerId;
  if (recipientUserId === input.actorId) return;
  if (detail.projectId && !await canAccessProjectDetail({ projectId: detail.projectId, userId: recipientUserId })) return;
  await upsertApprovalNotification({ ...input, recipientUserId, detailId: detail.id, detailTitle: detail.title });
}
