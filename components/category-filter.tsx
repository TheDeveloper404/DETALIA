// Filtru de categorii — link-uri (server-rendered, fără JS). Selectează exact o categorie sau „Toate".
// MVP: listă plată de chip-uri. (Refinare: grupare pe arbore parent→copii când taxonomia se adâncește.)
import Link from "next/link";

import { Button } from "./ui/button";

export type FilterCategory = { id: string; name: string };

export function CategoryFilter({
  categories,
  activeId,
}: {
  categories: FilterCategory[];
  activeId: string | null;
}) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Filtru categorii" className="flex flex-wrap gap-2">
      <Chip href="/feed" label="Toate" active={!activeId} />
      {categories.map((c) => (
        <Chip
          key={c.id}
          href={`/feed?cat=${c.id}`}
          label={c.name}
          active={activeId === c.id}
        />
      ))}
    </nav>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Button
      asChild
      size="sm"
      variant={active ? "default" : "outline"}
      className="rounded-full"
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}
