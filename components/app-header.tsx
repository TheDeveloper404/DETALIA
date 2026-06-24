import { PencilRuler } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getNotifications } from "@/server/services/notificationService";

import { BrandLogo } from "./brand-logo";
import { NotificationBell, type NotificationView } from "./notification-bell";
import { UserMenu } from "./user-menu";

type NotificationPayload = {
  detailId?: string;
  detailTitle?: string;
  sketchAuthorName?: string | null;
};

// Header global — apare DOAR pentru useri autentificați (landing/login/signup rămân fără header).
export async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Lista pentru dropdown-ul din clopoțel (mapată la o formă serializabilă pt client).
  const rows = await getNotifications(session.user.id);
  const notifications: NotificationView[] = rows.map((n) => {
    const p = (n.payloadJson ?? {}) as NotificationPayload;
    return {
      id: n.id,
      type: n.type,
      actorName: p.sketchAuthorName ?? null,
      detailTitle: p.detailTitle ?? "un detaliu",
      href: p.detailId ? `/details/${p.detailId}` : null,
      createdAt: n.createdAt.toISOString(),
      unread: n.readAt === null,
    };
  });
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6 py-3">
        <BrandLogo href="/feed" />
        <div className="flex items-center gap-1">
          <Link
            href="/sketches/drafts"
            aria-label="Ciornele mele"
            title="Ciornele mele"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <PencilRuler className="size-[18px]" strokeWidth={2} />
          </Link>
          <NotificationBell notifications={notifications} count={unread} />
          <UserMenu name={session.user.name ?? null} image={session.user.image ?? null} />
        </div>
      </div>
    </header>
  );
}
