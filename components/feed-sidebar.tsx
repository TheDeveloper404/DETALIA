// Coloana stângă a feed-ului — card mini de profil + listă de categorii (cu count + activ) + buton „Adaugă".
// Prezentațional (props-driven): feed-ul real îi dă date din sesiune/DB, preview-ul din mock.
import Link from "next/link";

import { CategoryFilterList, type SidebarCategory } from "./category-filter-list";

export type { SidebarCategory };
export type SidebarProfile = {
  name: string | null;
  image: string | null;
  coverImage: string | null;
  coverPosition: number | null;
  location: string | null;
  roleLabel: string | null;
  verified: boolean;
};

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function FeedSidebar({
  profile,
  categories,
  activeId,
  basePath = "/feed",
  total,
}: {
  profile: SidebarProfile;
  categories: SidebarCategory[];
  activeId: string | null;
  basePath?: string;
  total: number;
}) {
  return (
    // mt-2: aliniază cu containerul „Detalii în dezbatere" din main (are mt-2 propriu) și cu rail-ul
    // din dreapta — feedback Liviu, 2026-07-06.
    <aside className="mt-2 hidden flex-col gap-[18px] lg:sticky lg:top-[90px] lg:flex">
      {/* Card mini de profil. */}
      <Link
        href="/profile"
        className="block overflow-hidden rounded-lg bg-card no-underline ring-1 ring-foreground/10"
      >
        <div className="h-[54px] overflow-hidden bg-gradient-to-br from-secondary to-[#ece1d3]">
          {profile.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.coverImage}
              alt=""
              className="size-full object-cover"
              style={{ objectPosition: `50% ${profile.coverPosition ?? 50}%` }}
            />
          )}
        </div>
        <div className="px-[18px] pb-[18px]">
          <span className="-mt-[26px] flex size-[52px] items-center justify-center overflow-hidden rounded-full border-[3px] border-card bg-secondary font-mono text-base text-muted-foreground">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="" className="size-full object-cover" />
            ) : (
              initials(profile.name)
            )}
          </span>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="font-bold text-foreground">{profile.name ?? "Profilul tău"}</span>
            {profile.verified && (
              <span title="Rol verificat" aria-label="Rol verificat" className="text-[#d99a2b]">
                ★
              </span>
            )}
          </div>
          {(profile.roleLabel || profile.location) && (
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {profile.roleLabel}
              {profile.roleLabel && profile.location && " · "}
              {profile.location}
            </div>
          )}
        </div>
      </Link>

      {/* Categorii. */}
      <nav
        aria-label="Filtru categorii"
        className="rounded-lg bg-card p-2 ring-1 ring-foreground/10"
      >
        <div className="px-3 pb-2 pt-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Categorii
        </div>
        {/* Scroll intern — ierarhia completă (secțiuni + capitole + frunze) e mult mai lungă decât vechea
            listă flată trunchiată la 6; scroll-ul propriu ține sidebar-ul compact fără să ascundă nimic. */}
        <div className="max-h-[420px] overflow-y-auto">
          <CategoryFilterList
            categories={categories}
            activeId={activeId}
            basePath={basePath}
            total={total}
          />
        </div>
      </nav>
    </aside>
  );
}
