// Filtru de categorii — link-uri (server-rendered, fără JS). Selectează exact o categorie sau „Toate".
// MVP: listă plată de chip-uri. (Refinare: grupare pe arbore parent→copii când taxonomia se adâncește.)
import Link from "next/link";

export type FilterCategory = { id: string; name: string };

const baseChip =
  "rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";
const activeChip =
  "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
const idleChip =
  "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500";

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
      <Link href="/feed" className={`${baseChip} ${!activeId ? activeChip : idleChip}`}>
        Toate
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/feed?cat=${c.id}`}
          className={`${baseChip} ${activeId === c.id ? activeChip : idleChip}`}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
