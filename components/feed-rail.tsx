// Coloana dreaptă a feed-ului — autori activi + „cele mai dezbătute" + nudge de validare pe rol.
// Prezentațional (props-driven). „În dezbatere" = detaliile cu cele mai multe comentarii (derivat din feed).
import { Layers, MessageSquare } from "lucide-react";
import Link from "next/link";

import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";

import { AvatarInitials } from "./avatar-initials";

export type RailAuthor = {
  id: string;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verification: string | null;
  detailCount: number;
};
export type RailDebated = {
  id: string;
  title: string;
  categories: { id: string; name: string; slug: string }[];
  // null și pentru autor retras (mascat în SQL, vezi detailsRepo.ts) — fără link spre profil în acel caz.
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
  validationCount: number;
  commentCount: number;
  sketchCount: number;
};
export function FeedRail({
  authors,
  debated,
}: {
  authors: RailAuthor[];
  debated: RailDebated[];
}) {
  return (
    // Aliniere, sticky si max-h identice cu coloana din stanga (comentariul din feed-sidebar.tsx).
    <aside className="mt-1 hidden flex-col gap-3 xl:sticky xl:top-[112px] xl:-mx-1 xl:flex xl:max-h-[calc(100dvh-128px)] xl:overflow-y-auto xl:p-1">
      {/* Autori activi. */}
      {authors.length > 0 && (
        <div className="rounded-lg bg-card p-3 ring-1 ring-foreground/10">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Autori activi
          </div>
          <ul className="flex list-none flex-col gap-2 p-0">
            {authors.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/profile/${a.id}`}
                  className="flex items-center gap-2.5 no-underline"
                >
                  <AvatarInitials name={a.name} imageUrl={a.image} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                      {a.name ?? "Anonim"}
                      {a.verification === "VERIFIED" && (
                        <span className="text-[#d99a2b]" title="Rol verificat">★</span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {a.subRole ?? (a.roleMain ? ROLE_MAIN_LABELS[a.roleMain as RoleMain] ?? a.roleMain : "—")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    {a.detailCount} detalii
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cele mai dezbătute. */}
      {debated.length > 0 && (
        <div className="rounded-lg bg-card p-3 ring-1 ring-foreground/10">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Cele mai dezbătute
          </div>
          <ul className="flex list-none flex-col gap-2 p-0">
            {debated.map((d, i) => (
              <li key={d.id} className={i > 0 ? "border-t border-[#eee6da] pt-2" : undefined}>
                {/* Link separat de cel spre detaliu de mai jos (nu imbricat — un <a> în alt <a> e HTML
                    invalid). Autor retras (authorId mascat null în SQL) → fără link, doar text. */}
                {d.authorId ? (
                  <Link href={`/profile/${d.authorId}`} className="mb-1 flex items-center gap-2 no-underline">
                    <AvatarInitials name={d.authorName} imageUrl={d.authorImage} size={22} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground hover:text-foreground">
                      {d.authorName ?? "Anonim"}
                      {d.authorVerification === "VERIFIED" && (
                        <span className="ml-1 text-[#d99a2b]" title="Rol verificat">★</span>
                      )}
                      {" · "}
                      {d.authorSubRole ??
                        (d.authorRoleMain ? (ROLE_MAIN_LABELS[d.authorRoleMain as RoleMain] ?? d.authorRoleMain) : "—")}
                    </span>
                  </Link>
                ) : (
                  <div className="mb-1 flex items-center gap-2">
                    <AvatarInitials name={d.authorName} imageUrl={d.authorImage} size={22} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {d.authorName ?? "Anonim"}
                      {" · "}
                      {d.authorSubRole ??
                        (d.authorRoleMain ? (ROLE_MAIN_LABELS[d.authorRoleMain as RoleMain] ?? d.authorRoleMain) : "—")}
                    </span>
                  </div>
                )}
                <Link href={`/details/${d.id}`} className="block no-underline">
                  <div className="text-[13.5px] font-semibold leading-snug text-foreground hover:text-primary">{d.title}</div>
                  {d.categories.length > 0 && (
                    <span className="mt-0.5 inline-block rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                      {d.categories[0].name}
                      {d.categories.length > 1 && ` +${d.categories.length - 1}`}
                    </span>
                  )}
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span>{d.validationCount} validări</span>
                      <span className="text-border">·</span>
                      <span className="inline-flex items-center gap-1" title="Comentarii">
                        <MessageSquare className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="sr-only">comentarii:</span>
                        {d.commentCount}
                      </span>
                      <span className="text-border">·</span>
                      <span className="inline-flex items-center gap-1" title="Schițe în teanc">
                        <Layers className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="sr-only">schițe în teanc:</span>
                        {d.sketchCount}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copyright stil LinkedIn — ultimul element din rail. În flow normal stă mereu sub carduri,
          deci pe măsură ce apar containere noi deasupra, e împins natural în jos. */}
      <p className="px-1 pb-2 text-[11.5px] leading-relaxed text-muted-foreground">
        <Link href="/termeni" className="no-underline hover:underline">Termeni</Link>
        {" · "}
        <Link href="/confidentialitate" className="no-underline hover:underline">Confidențialitate</Link>
        {" · "}
        <Link href="/ghid" className="no-underline hover:underline">Ghid de utilizare</Link>
        <br />© {new Date().getFullYear()} Detalia.ro — Toate drepturile rezervate.
      </p>
    </aside>
  );
}
