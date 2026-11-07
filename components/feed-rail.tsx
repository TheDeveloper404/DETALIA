// Coloana dreaptă a feed-ului — autori activi + top global după numărul de comentarii.
// Prezentațional (props-driven); ordinea vine de la server, independent de filtrele feed-ului.
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
    // Aliniat cu sidebar-ul din stanga; continutul urmeaza scroll-ul paginii, fara scroll intern.
    <aside className="mt-1 hidden flex-col gap-6 xl:sticky xl:top-[112px] xl:flex">
      {/* Autori activi. */}
      {authors.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-foreground">
            <span className="h-0.5 w-5 shrink-0 bg-primary" aria-hidden />
            Autori activi
          </h2>
          <ul className="flex list-none flex-col gap-4 p-0">
            {authors.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/profile/${a.id}`}
                  className="group flex items-center gap-2.5 no-underline"
                >
                  <AvatarInitials name={a.name} imageUrl={a.image} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-semibold text-foreground group-hover:text-primary">
                      <span className="truncate">{a.name ?? "Anonim"}</span>
                      {a.verification === "VERIFIED" && (
                        <span className="shrink-0 text-[#d99a2b]" title="Rol verificat">★</span>
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
        </section>
      )}

      {/* Cele mai dezbătute. */}
      {debated.length > 0 && (
        <section className="border-t border-border pt-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-foreground">
            <span className="h-0.5 w-5 shrink-0 bg-primary" aria-hidden />
            Cele mai dezbătute
          </h2>
          <ul className="flex list-none flex-col gap-5 p-0">
            {debated.map((d) => (
              <li key={d.id}>
                <Link href={`/details/${d.id}`} className="mb-1.5 block text-[15px] font-semibold leading-snug text-foreground no-underline hover:text-primary">
                  {d.title}
                </Link>
                {/* Link separat de cel spre detaliu de mai sus (nu imbricat — un <a> în alt <a> e HTML
                    invalid). Autor retras (authorId mascat null în SQL) → fără link, doar text. */}
                {d.authorId ? (
                  <Link href={`/profile/${d.authorId}`} className="flex items-center gap-2 no-underline">
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
                  <div className="flex items-center gap-2">
                    <AvatarInitials name={d.authorName} imageUrl={d.authorImage} size={22} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {d.authorName ?? "Anonim"}
                      {" · "}
                      {d.authorSubRole ??
                        (d.authorRoleMain ? (ROLE_MAIN_LABELS[d.authorRoleMain as RoleMain] ?? d.authorRoleMain) : "—")}
                    </span>
                  </div>
                )}
                <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span>{d.validationCount} validări</span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1" title="Comentarii">
                      <MessageSquare className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                      {d.commentCount} {d.commentCount === 1 ? "comentariu" : "comentarii"}
                    </span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1" title="Schițe în teanc">
                      <Layers className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                      {d.sketchCount} {d.sketchCount === 1 ? "schiță" : "schițe"}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Copyright stil LinkedIn — ultimul element din rail. În flow normal stă mereu sub carduri,
          deci pe măsură ce apar containere noi deasupra, e împins natural în jos. */}
      <p className="pb-2 text-[11.5px] leading-relaxed text-muted-foreground">
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
