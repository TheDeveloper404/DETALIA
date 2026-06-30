import { PencilRuler, Search } from "lucide-react";
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
  sketchAuthorRole?: string | null;
  sketchAuthorVerified?: boolean;
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
      actorRole: p.sketchAuthorRole ?? null,
      actorVerified: p.sketchAuthorVerified ?? false,
      detailTitle: p.detailTitle ?? "un detaliu",
      href: p.detailId ? `/details/${p.detailId}` : null,
      createdAt: n.createdAt.toISOString(),
      unread: n.readAt === null,
    };
  });
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-50 flex h-[76px] items-center border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6">
        <BrandLogo href="/feed" size={32} />

        {/* Căutare simplă pe titlu — form GET nativ (merge fără JS) spre feed. */}
        <form action="/feed" className="mx-4 hidden max-w-sm flex-1 md:block" role="search">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
            />
            <input
              type="search"
              name="q"
              placeholder="Caută detalii…"
              aria-label="Caută detalii"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
        </form>

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
