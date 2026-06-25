import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getNotifications } from "@/server/services/notificationService";

import { MarkReadOnView } from "./mark-read-on-view";

type Payload = { detailId?: string; detailTitle?: string; sketchAuthorName?: string | null };

function describe(type: string, p: Payload): { text: string; href: string | null } {
  const title = p.detailTitle ?? "un detaliu";
  const href = p.detailId ? `/details/${p.detailId}` : null;
  switch (type) {
    case "SKETCH_PROPOSED":
      return { text: `${p.sketchAuthorName ?? "Cineva"} a propus o schiță la „${title}”.`, href };
    case "SKETCH_ACCEPTED":
      return { text: `Schița ta la „${title}” a fost acceptată.`, href };
    case "SKETCH_REJECTED":
      return { text: `Schița ta la „${title}” a fost respinsă.`, href };
    default:
      return { text: "Notificare.", href };
  }
}

const dateFmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const notifications = await getNotifications(session.user.id);
  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <MarkReadOnView hasUnread={hasUnread} />

      <h1 className="text-2xl font-semibold tracking-tight">Notificări</h1>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Nu ai nicio notificare încă.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const { text, href } = describe(n.type, (n.payloadJson ?? {}) as Payload);
            const unread = n.readAt === null;
            const content = (
              <div
                className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  unread ? "border-border bg-muted/50" : "border-border"
                } ${href ? "hover:border-foreground/30" : ""}`}
              >
                <p className="text-sm text-foreground/90">{text}</p>
                <span className="text-xs text-muted-foreground">{dateFmt.format(n.createdAt)}</span>
              </div>
            );
            return (
              <li key={n.id}>{href ? <Link href={href}>{content}</Link> : content}</li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
