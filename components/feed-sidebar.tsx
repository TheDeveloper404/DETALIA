// Coloana stângă a feed-ului — card mini de profil + „Conținutul meu" + listă de categorii (cu count + activ).
// Prezentațional (props-driven): feed-ul real îi dă date din sesiune/DB, preview-ul din mock.
import { Bookmark, FolderKanban, LayoutDashboard, PencilLine } from "lucide-react";
import Link from "next/link";

import { PersonSilhouette } from "./avatar-initials";
import { CategoryFilterList, type SidebarCategory } from "./category-filter-list";

export type { SidebarCategory };
export type SidebarProfile = {
  name: string | null;
  image: string | null;
  location: string | null;
  roleLabel: string | null;
  verified: boolean;
};

const MY_CONTENT_LINK =
  "flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-secondary/60";

export function FeedSidebar({
  profile,
  categories,
  activeIds,
  basePath = "/feed",
  total,
  savedCount,
  q = null,
  unanswered = false,
  filterQuery = "",
}: {
  profile: SidebarProfile;
  categories: SidebarCategory[];
  activeIds: string[];
  basePath?: string;
  total: number;
  savedCount: number;
  q?: string | null;
  unanswered?: boolean;
  filterQuery?: string;
}) {
  return (
    // mt-1 + p-1: primul card ramane la 8px, aliniat cu „Detalii în dezbatere" din main si cu rail-ul.
    // sticky la exact pozitia de start (header 80 + pt-7 al grilei + mt-1), ca sa nu urce la scroll;
    // max-h + scroll doar daca o sectiune deschisa nu mai incape pe ecran. -mx-1/p-1 lasa loc inelelor cardurilor.
    <aside className="mt-1 hidden flex-col gap-3 lg:sticky lg:top-[112px] lg:-mx-1 lg:flex lg:max-h-[calc(100dvh-128px)] lg:overflow-y-auto lg:p-1">
      <Link
        href="/profile"
        data-tour="profile"
        className="flex items-center gap-2.5 rounded-lg bg-card px-3 py-2.5 no-underline ring-1 ring-foreground/10"
      >
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-sm text-muted-foreground">
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.image} alt="" className="size-full object-cover" />
          ) : (
            <PersonSilhouette className="size-5" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">{profile.name ?? "Profilul tău"}</span>
            {profile.verified && (
              <span title="Rol verificat" aria-label="Rol verificat" className="text-[#d99a2b]">
                ★
              </span>
            )}
          </span>
          {(profile.roleLabel || profile.location) && (
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {profile.roleLabel}
              {profile.roleLabel && profile.location && " · "}
              {profile.location}
            </span>
          )}
        </span>
      </Link>

      {/* „Conținutul meu" — mutat aici din meniul de avatar (2026-08-26): erau ascunse sub un icon de
          cont, nedescoperibile ca navigare de conținut. */}
      <nav
        aria-label="Conținutul meu"
        data-tour="my-content"
        className="grid grid-cols-2 gap-0.5 rounded-lg bg-card p-1 ring-1 ring-foreground/10"
      >
        <Link href="/projects" className={MY_CONTENT_LINK}>
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          Proiecte
        </Link>
        <Link href="/canvases" className={MY_CONTENT_LINK}>
          <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          Planșe
        </Link>
        <Link href="/saved" className={`${MY_CONTENT_LINK} justify-between`}>
          <span className="flex items-center gap-2">
            <Bookmark className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            Salvate
          </span>
          <span className="font-mono text-xs text-muted-foreground">{savedCount}</span>
        </Link>
        <Link href="/sketches/drafts" className={MY_CONTENT_LINK}>
          <PencilLine className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          Ciorne
        </Link>
      </nav>

      <nav
        aria-label="Filtru categorii"
        data-tour="categories"
        className="rounded-lg bg-card p-2 ring-1 ring-foreground/10"
      >
        <div className="px-3 pb-1.5 pt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Categorii
        </div>
        <CategoryFilterList
          categories={categories}
          activeIds={activeIds}
          basePath={basePath}
          total={total}
          q={q}
          unanswered={unanswered}
          filterQuery={filterQuery}
          sidebar
        />
      </nav>
    </aside>
  );
}
