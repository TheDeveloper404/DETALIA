// Coloana dreaptă a feed-ului — autori activi + „în dezbatere acum" + nudge de validare pe rol.
// Prezentațional (props-driven). „În dezbatere" = detaliile cu cele mai multe comentarii (derivat din feed).
import Link from "next/link";

import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";

import { AvatarInitials } from "./avatar-initials";

export type RailAuthor = {
  id: string;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  verification: string | null;
  detailCount: number;
};
export type RailDebated = {
  id: string;
  title: string;
  commentCount: number;
  sketchCount: number;
};
export type RailSketch = {
  id: string;
  detailId: string;
  thumbnailUrl: string | null;
  detailTitle: string;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorVerified: boolean;
};

export function FeedRail({
  authors,
  debated,
  sketches,
}: {
  authors: RailAuthor[];
  debated: RailDebated[];
  sketches: RailSketch[];
}) {
  return (
    <aside className="hidden flex-col gap-[18px] xl:sticky xl:top-[90px] xl:flex">
      {/* Autori activi. */}
      {authors.length > 0 && (
        <div className="rounded-lg bg-card p-[18px] ring-1 ring-foreground/10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Autori activi
          </div>
          <ul className="flex list-none flex-col gap-3 p-0">
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
                      {a.roleMain ? ROLE_MAIN_LABELS[a.roleMain as RoleMain] ?? a.roleMain : "—"} ·{" "}
                      {a.detailCount} detalii
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* În dezbatere acum. */}
      {debated.length > 0 && (
        <div className="rounded-lg bg-card p-[18px] ring-1 ring-foreground/10">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            În dezbatere acum
          </div>
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {debated.map((d, i) => (
              <li key={d.id} className={i > 0 ? "border-t border-[#eee6da] pt-3.5" : undefined}>
                <Link
                  href={`/details/${d.id}`}
                  className="block font-semibold leading-snug text-foreground no-underline hover:text-primary"
                >
                  {d.title}
                </Link>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {d.commentCount} comentarii · {d.sketchCount} schițe
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Schițe noi în teanc — propunerile desenate recent publicate (diferențiatorul fork+PR). */}
      {sketches.length > 0 && (
        <div className="rounded-lg bg-card p-[18px] ring-1 ring-foreground/10">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Schițe noi în teanc
          </div>
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {sketches.map((s, i) => (
              <li key={s.id} className={i > 0 ? "border-t border-[#eee6da] pt-3.5" : undefined}>
                <Link
                  href={`/details/${s.detailId}`}
                  className="flex items-center gap-3 no-underline"
                >
                  <span className="size-12 flex-none overflow-hidden rounded-md border border-[#eee6da] bg-[#faf7f1]">
                    {s.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnailUrl} alt="" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {s.detailTitle}
                    </span>
                    <span className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
                      {s.authorName ?? "Anonim"}
                      {s.authorVerified && (
                        <span className="text-[#d99a2b]" title="Rol verificat">★</span>
                      )}
                      {s.authorRoleMain && (
                        <> · {ROLE_MAIN_LABELS[s.authorRoleMain as RoleMain] ?? s.authorRoleMain}</>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nudge: validează pe rolul tău. */}
      <div className="rounded-lg border border-border bg-secondary p-[18px]">
        <div className="mb-1.5 font-bold text-foreground">Validează pe rolul tău</div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          O dezaprobare vine mereu cu o justificare. Părerea ta cântărește prin rolul afișat lângă nume.
        </p>
      </div>

      {/* Copyright stil LinkedIn — ultimul element din rail. În flow normal stă mereu sub carduri,
          deci pe măsură ce apar containere noi deasupra, e împins natural în jos. */}
      <p className="px-1 pb-2 text-[11.5px] leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} Detalia.ro — Toate drepturile rezervate.
      </p>
    </aside>
  );
}
