import Link from "next/link";

import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/server/services/notificationService";

import { BrandLogo } from "./brand-logo";
import { NotificationBell } from "./notification-bell";

// Header global — apare DOAR pentru useri autentificați (landing/login/signup rămân fără header).
export async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const unread = await getUnreadCount(session.user.id);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6 py-3">
        <BrandLogo href="/feed" />
        <div className="flex items-center gap-1">
          <NotificationBell count={unread} />
          <Link
            href="/profile"
            aria-label="Profilul tău"
            className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {(session.user.name?.trim()?.[0] ?? "?").toUpperCase()}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
