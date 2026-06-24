// Coloana stângă a feed-ului — card mini de profil + listă de categorii (cu count + activ) + buton „Adaugă".
// Prezentațional (props-driven): feed-ul real îi dă date din sesiune/DB, preview-ul din mock.
import Link from "next/link";

export type SidebarCategory = { id: string; name: string; count: number };
export type SidebarProfile = {
  name: string | null;
  image: string | null;
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
  addHref = "/details/new",
  total,
}: {
  profile: SidebarProfile;
  categories: SidebarCategory[];
  activeId: string | null;
  basePath?: string;
  addHref?: string;
  total: number;
}) {
  return (
    <aside className="hidden flex-col gap-[18px] lg:sticky lg:top-[90px] lg:flex">
      {/* Card mini de profil. */}
      <Link
        href="/profile"
        className="block overflow-hidden rounded-lg bg-card no-underline ring-1 ring-foreground/10"
      >
        <div className="h-[54px] bg-gradient-to-br from-secondary to-[#ece1d3]" />
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
          {profile.roleLabel && (
            <div className="mt-1 font-mono text-xs text-muted-foreground">{profile.roleLabel}</div>
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
        <CategoryLink href={basePath} label="Toate detaliile" count={total} active={!activeId} />
        {categories.map((c) => (
          <CategoryLink
            key={c.id}
            href={`${basePath}?cat=${c.id}`}
            label={c.name}
            count={c.count}
            active={activeId === c.id}
          />
        ))}
      </nav>

      <Link
        href={addHref}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#95492e] bg-primary px-4 py-3 font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Adaugă detaliu
      </Link>
    </aside>
  );
}

function CategoryLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[14.5px] no-underline transition-colors ${
        active
          ? "bg-secondary font-semibold text-foreground"
          : "text-foreground/80 hover:bg-secondary"
      }`}
    >
      {label}
      <span className={`font-mono text-[11.5px] ${active ? "text-primary" : "text-muted-foreground"}`}>
        {count}
      </span>
    </Link>
  );
}
