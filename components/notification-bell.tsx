"use client";

import { ArrowRight, Bell, Check, CheckCheck, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { markOneReadAction, markReadAction } from "@/app/(app)/notifications/actions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { RolePill } from "./role-pill";

export type NotificationView = {
  id: string;
  type: "SKETCH_PROPOSED" | "SKETCH_ACCEPTED" | "SKETCH_REJECTED" | "SKETCH_DELETED";
  actorName: string | null;
  actorRole: string | null;
  actorSubRole: string | null;
  actorVerified: boolean;
  detailTitle: string;
  href: string | null;
  createdAt: string; // ISO
  unread: boolean;
};

const TYPE_STYLE = {
  SKETCH_PROPOSED: {
    sqBg: "#f6ede4",
    sqBorder: "#ecdcc8",
    icon: <Pencil className="size-[18px] text-primary" strokeWidth={1.9} />,
  },
  SKETCH_ACCEPTED: {
    sqBg: "#e9f2ea",
    sqBorder: "#cfe3d2",
    icon: <Check className="size-[19px] text-[#2f6b3f]" strokeWidth={2.4} />,
  },
  SKETCH_REJECTED: {
    sqBg: "#f6ebe9",
    sqBorder: "#ecd6d2",
    icon: <X className="size-4 text-destructive" strokeWidth={2.4} />,
  },
  SKETCH_DELETED: {
    sqBg: "#f6ebe9",
    sqBorder: "#ecd6d2",
    icon: <Trash2 className="size-4 text-destructive" strokeWidth={2} />,
  },
} as const;

// Textul notificării pe datele reale din payload (fără a inventa rol/identitate lipsă).
// Titlul e `span`, NU link: rândul întreg e deja un <Link> spre același detaliu (evită <a> imbricat).
function NotificationText({ n }: { n: NotificationView }) {
  const ref = <span className="font-semibold text-primary">«{n.detailTitle}»</span>;

  if (n.type === "SKETCH_PROPOSED") {
    return (
      <>
        <b className="font-bold text-foreground">{n.actorName ?? "Cineva"}</b>
        {n.actorRole && (
          <>
            {" "}
            <RolePill roleMain={n.actorRole} subRole={n.actorSubRole} verified={n.actorVerified} />
          </>
        )}{" "}
        a schițat peste {ref}.
      </>
    );
  }
  if (n.type === "SKETCH_DELETED") {
    return <>Schița ta la {ref} a fost eliminată de autorul detaliului.</>;
  }
  // Tipuri moștenite din fluxul vechi cu acceptare (nemaiproduse, dar pot exista în istoric).
  if (n.type === "SKETCH_ACCEPTED") {
    return <>Schița ta la {ref} a fost acceptată — e publică în teanc.</>;
  }
  return <>Schița ta la {ref} a fost respinsă.</>;
}

export function NotificationBell({
  notifications,
  count,
}: {
  notifications: NotificationView[];
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [allRead, setAllRead] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Închide la click în afară + Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = allRead
    ? 0
    : Math.max(
        0,
        count - notifications.filter((n) => n.unread && readIds.has(n.id)).length,
      );
  const hasItems = notifications.length > 0;

  async function markAll() {
    setAllRead(true); // optimist
    await markReadAction();
    router.refresh();
  }

  // Clic pe o notificare → o marchează citită (optimist) + navighează (Link-ul gestionează ruta).
  function markOne(id: string) {
    setOpen(false);
    setReadIds((prev) => new Set(prev).add(id));
    void markOneReadAction(id).then(() => router.refresh());
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificări (${unreadCount} necitite)` : "Notificări"}
        aria-expanded={open}
        className={cn(
          // Cerc ghost, identic cu „Ciornele" și avatarul (consistență header). Starea „necitite" o semnalează
          // DOAR bulina roșie, nu o bordură/fundal — altfel butonul arăta ca o cutie între două cercuri.
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          open ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Bell className="size-[18px]" strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 font-mono text-[10px] text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#eee6da] px-4 py-3">
            <div>
              <h2 className="font-heading text-[15px] font-bold">Notificări</h2>
            </div>
            <button
              type="button"
              onClick={markAll}
              disabled={unreadCount === 0}
              className={cn(
                "inline-flex flex-none items-center gap-1.5 font-heading text-[13px] font-semibold",
                unreadCount === 0 ? "cursor-default text-[#c4bbac]" : "text-primary hover:underline",
              )}
            >
              <CheckCheck className="size-[15px]" strokeWidth={2} />
              <span className="hidden sm:inline">Marchează toate</span>
            </button>
          </div>

          {/* listă */}
          {hasItems ? (
            <ul className="max-h-[70vh] divide-y divide-[#eee6da] overflow-y-auto">
              {notifications.map((n) => {
                const unread = n.unread && !allRead && !readIds.has(n.id);
                const ts = TYPE_STYLE[n.type];
                const row = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 transition-colors",
                      unread ? "bg-[#f9f1e8] hover:bg-[#f2e6d8]" : "hover:bg-secondary",
                    )}
                  >
                    {/* gutter punct necitit */}
                    <span className="flex w-2 flex-none justify-center pt-3.5">
                      {unread && <span className="block size-2 rounded-full bg-primary" />}
                    </span>

                    {/* pătrat iconiță tip */}
                    <span
                      className="flex size-10 flex-none items-center justify-center rounded-[11px] border"
                      style={{ background: ts.sqBg, borderColor: ts.sqBorder }}
                    >
                      {ts.icon}
                    </span>

                    {/* text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <p className="min-w-0 flex-1 text-[14.5px] leading-snug text-foreground/80 text-pretty">
                          <NotificationText n={n} />
                        </p>
                        <span className="hidden flex-none pt-0.5 font-mono text-[11.5px] text-[#a59a88] sm:block">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>

                      {n.type === "SKETCH_PROPOSED" && n.href && (
                        // CTA vizual (span, nu link) — rândul-Link de mai jos face navigarea spre același detaliu.
                        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] border border-[#ecdcc8] bg-[#f6ede4] px-3 py-1.5 font-heading text-[13px] font-semibold text-primary">
                          Vezi schița în teanc
                          <ArrowRight className="size-3.5" strokeWidth={2} />
                        </span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => markOne(n.id)} className="block">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-8 py-12 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-[14px] border border-[#e6ddcf] bg-secondary">
                <Bell className="size-6 text-primary" strokeWidth={1.8} />
              </div>
              <h3 className="font-heading text-base font-bold">Nicio notificare încă</h3>
              <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted-foreground">
                Te anunțăm când cineva propune o schiță pe detaliile tale — sau când schițele tale
                primesc un răspuns.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
