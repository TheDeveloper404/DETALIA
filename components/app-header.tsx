import { House, LayoutDashboard, PencilRuler, Search } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getNotifications } from "@/server/services/notificationService";
import { getUserMedia } from "@/server/repos/usersRepo";

import { BrandLogo } from "./brand-logo";
import { NotificationBell, type NotificationView } from "./notification-bell";
import { UserMenu } from "./user-menu";

type NotificationPayload = {
  detailId?: string;
  detailTitle?: string;
  sketchAuthorName?: string | null;
  sketchAuthorRole?: string | null;
  sketchAuthorSubRole?: string | null;
  sketchAuthorVerified?: boolean;
};

// Header global — apare DOAR pentru useri autentificați (landing/login/signup rămân fără header).
export async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Poza de profil vine din DB, nu din sesiune (JWT-ul cache-uiește `image` doar la login →
  // stale după onboarding/schimbare poză, până la re-login).
  const [rows, media] = await Promise.all([
    getNotifications(session.user.id),
    getUserMedia(session.user.id),
  ]);
  const notifications: NotificationView[] = rows.map((n) => {
    const p = (n.payloadJson ?? {}) as NotificationPayload;
    return {
      id: n.id,
      type: n.type,
      actorName: p.sketchAuthorName ?? null,
      actorRole: p.sketchAuthorRole ?? null,
      actorSubRole: p.sketchAuthorSubRole ?? null,
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
            href="/feed"
            aria-label="Acasă"
            title="Acasă"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <House className="size-[18px]" strokeWidth={2} />
          </Link>
          <Link
            href="/sketches/drafts"
            aria-label="Ciornele mele"
            title="Ciornele mele"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <PencilRuler className="size-[18px]" strokeWidth={2} />
          </Link>
          <Link
            href="/canvases"
            aria-label="Planșele mele"
            title="Planșele mele"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <LayoutDashboard className="size-[18px]" strokeWidth={2} />
          </Link>
          <NotificationBell notifications={notifications} count={unread} />
          <UserMenu name={session.user.name ?? null} image={media?.image ?? null} />
        </div>
      </div>
    </header>
  );
}
