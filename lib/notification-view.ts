// Mapare rând DB → shape de UI pt. notificări — extrasă din app-header.tsx (2026-08-26) ca să fie
// reutilizabilă și de server action-ul de polling (notifications/actions.ts), nu doar de randarea
// inițială din header. Pură, fără I/O — sigură de importat și din Server, și din Client Components.
import type { NotificationView } from "@/components/notification-bell";

type NotificationPayload = {
  detailId?: string;
  sketchId?: string;
  detailTitle?: string;
  sketchAuthorName?: string | null;
  sketchAuthorRole?: string | null;
  sketchAuthorSubRole?: string | null;
  sketchAuthorVerified?: boolean;
  supplierName?: string | null;
  joinedUserName?: string | null;
};

export type NotificationRow = {
  id: string;
  type: NotificationView["type"];
  payloadJson: unknown;
  createdAt: Date;
  readAt: Date | null;
};

export function mapNotificationRows(rows: NotificationRow[]): NotificationView[] {
  return rows.map((n) => {
    const p = (n.payloadJson ?? {}) as NotificationPayload;
    return {
      id: n.id,
      type: n.type,
      actorName: p.sketchAuthorName ?? p.supplierName ?? p.joinedUserName ?? null,
      actorRole: p.sketchAuthorRole ?? null,
      actorSubRole: p.sketchAuthorSubRole ?? null,
      actorVerified: p.sketchAuthorVerified ?? false,
      detailTitle: p.detailTitle ?? "un detaliu",
      href: p.detailId ? `/details/${p.detailId}${p.sketchId ? `?sketch=${p.sketchId}` : ""}` : null,
      createdAt: n.createdAt.toISOString(),
      unread: n.readAt === null,
    };
  });
}
