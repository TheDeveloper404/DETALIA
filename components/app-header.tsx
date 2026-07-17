import { House } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getNotifications } from "@/server/services/notificationService";
import { getUserMedia } from "@/server/repos/usersRepo";
import { getUserRole } from "@/server/services/roleService";

import { BrandLogo } from "./brand-logo";
import { NotificationBell, type NotificationView } from "./notification-bell";
import { UserMenu } from "./user-menu";

type NotificationPayload = {
  detailId?: string;
  sketchId?: string;
  detailTitle?: string;
  sketchAuthorName?: string | null;
  sketchAuthorRole?: string | null;
  sketchAuthorSubRole?: string | null;
  sketchAuthorVerified?: boolean;
  supplierName?: string | null;
};

// Header global — apare DOAR pentru useri autentificați (landing/login/signup rămân fără header).
export async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Poza de profil vine din DB, nu din sesiune (JWT-ul cache-uiește `image` doar la login →
  // stale după onboarding/schimbare poză, până la re-login).
  const [rows, media, role] = await Promise.all([
    getNotifications(session.user.id),
    getUserMedia(session.user.id),
    getUserRole(session.user.id),
  ]);
  const notifications: NotificationView[] = rows.map((n) => {
    const p = (n.payloadJson ?? {}) as NotificationPayload;
    return {
      id: n.id,
      type: n.type,
      actorName: p.sketchAuthorName ?? p.supplierName ?? null,
      actorRole: p.sketchAuthorRole ?? null,
      actorSubRole: p.sketchAuthorSubRole ?? null,
      actorVerified: p.sketchAuthorVerified ?? false,
      detailTitle: p.detailTitle ?? "un detaliu",
      href: p.detailId
        ? `/details/${p.detailId}${p.sketchId ? `?sketch=${p.sketchId}` : ""}`
        : null,
      createdAt: n.createdAt.toISOString(),
      unread: n.readAt === null,
    };
  });
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-50 flex h-[80px] items-center border-b border-border bg-secondary/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6">
        <BrandLogo href="/feed" size={38} />

        <div className="flex items-center gap-1.5">
          <Link
            href="/feed"
            aria-label="Acasă"
            title="Acasă"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <House className="size-5" strokeWidth={2} />
          </Link>
          <NotificationBell notifications={notifications} count={unread} />
          <UserMenu
            name={media?.name ?? session.user.name ?? null}
            image={media?.image ?? null}
            isFurnizor={role?.roleMain === "FURNIZOR"}
          />
        </div>
      </div>
    </header>
  );
}
