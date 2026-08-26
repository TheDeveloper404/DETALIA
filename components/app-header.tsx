import { auth } from "@/lib/auth";
import { mapNotificationRows } from "@/lib/notification-view";
import { getNotifications } from "@/server/services/notificationService";
import { getUserMedia } from "@/server/repos/usersRepo";

import { BrandLogoHome, HomeIconLink } from "./feed-home-links";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

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
  const notifications = mapNotificationRows(rows);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-50 flex h-[80px] items-center border-b border-border bg-secondary/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6">
        <BrandLogoHome size={38} />

        <div className="flex items-center gap-1.5">
          <HomeIconLink />
          <NotificationBell notifications={notifications} count={unread} />
          <UserMenu
            name={media?.name ?? session.user.name ?? null}
            image={media?.image ?? null}
          />
        </div>
      </div>
    </header>
  );
}
