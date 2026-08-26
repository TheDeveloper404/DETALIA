// Coloana stângă a feed-ului — card mini de profil + listă de categorii (cu count + activ) + buton „Adaugă".
// Prezentațional (props-driven): feed-ul real îi dă date din sesiune/DB, preview-ul din mock.
import { Bookmark, FolderKanban, LayoutDashboard, PencilLine } from "lucide-react";
import Link from "next/link";

import { PersonSilhouette } from "./avatar-initials";
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
  about: string | null;
};

// Doar un preview scurt din „Despre" (nu tot textul) — cardul de sidebar rămâne compact, detaliul
// complet se citește pe /profile.
const ABOUT_PREVIEW_WORDS = 14;
export function aboutPreview(about: string | null): string | null {
  const trimmed = about?.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  if (words.length <= ABOUT_PREVIEW_WORDS) return words.join(" ");
  return words.slice(0, ABOUT_PREVIEW_WORDS).join(" ") + "…";
}

export function FeedSidebar({
  profile,
  categories,
  activeId,
  basePath = "/feed",
  total,
  savedCount,
}: {
  profile: SidebarProfile;
  categories: SidebarCategory[];
  activeId: string | null;
  basePath?: string;
  total: number;
  savedCount: number;
}) {
  return (
    // mt-2: aliniază cu containerul „Detalii în dezbatere" din main (are mt-2 propriu) și cu rail-ul
    // din dreapta (2026-07-06).
    <aside className="mt-2 hidden flex-col gap-[18px] lg:sticky lg:top-[94px] lg:flex">
      {/* Card mini de profil. */}
      <Link
        href="/profile"
        data-tour="profile"
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
              <PersonSilhouette className="size-7" />
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
          {aboutPreview(profile.about) && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {aboutPreview(profile.about)}
            </p>
          )}
        </div>
      </Link>

      {/* „Conținutul meu" — mutat aici din meniul de avatar (2026-08-26): erau ascunse sub un icon de
          cont, nedescoperibile ca navigare de conținut. */}
      <nav aria-label="Conținutul meu" className="rounded-lg bg-card p-1 ring-1 ring-foreground/10">
        <Link
          href="/projects"
          className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-secondary/60"
        >
          <FolderKanban className="size-4 text-muted-foreground" strokeWidth={2} />
          Proiecte
        </Link>
        <Link
          href="/canvases"
          className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-secondary/60"
        >
          <LayoutDashboard className="size-4 text-muted-foreground" strokeWidth={2} />
          Planșele mele
        </Link>
        <Link
          href="/saved"
          className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-secondary/60"
        >
          <span className="flex items-center gap-2">
            <Bookmark className="size-4 text-muted-foreground" strokeWidth={2} />
            Detalii salvate
          </span>
          <span className="font-mono text-xs text-muted-foreground">{savedCount}</span>
        </Link>
        <Link
          href="/sketches/drafts"
          className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-secondary/60"
        >
          <PencilLine className="size-4 text-muted-foreground" strokeWidth={2} />
          Ciorne
        </Link>
      </nav>

      {/* Categorii. */}
      <nav
        aria-label="Filtru categorii"
        data-tour="categories"
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
