import Link from "next/link";

import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/server/services/notificationService";

import { NotificationBell } from "./notification-bell";

// Header global — apare DOAR pentru useri autentificați (landing/login/signup rămân fără header).
export async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const unread = await getUnreadCount(session.user.id);

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/feed" className="text-lg font-semibold tracking-tight">
          DETALIA
        </Link>
        <NotificationBell count={unread} />
      </div>
    </header>
  );
}
