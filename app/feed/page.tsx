import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryFilter } from "@/components/category-filter";
import { DetailCard } from "@/components/detail-card";
import { auth } from "@/lib/auth";
import { listCategories } from "@/server/services/categoryService";
import { getFeed } from "@/server/services/detailService";

// Feed = suprafața principală autenticată. Finit (~20), sortat după interacțiuni, filtrabil pe categorie.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat } = await searchParams;
  const categories = await listCategories();

  // Acceptăm filtrul doar dacă e o categorie reală (altfel îl ignorăm — fără input arbitrar).
  const activeId = cat && categories.some((c) => c.id === cat) ? cat : null;
  const details = await getFeed({ categoryId: activeId });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Detalii</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Detalii de execuție din comunitate. Aprobă, dezaprobă sau propune o schiță.
          </p>
        </div>
        <Link
          href="/details/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Adaugă detaliu
        </Link>
      </header>

      <CategoryFilter
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        activeId={activeId}
      />

      {details.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {activeId
              ? "Nu există încă detalii în această categorie."
              : "Nu există încă niciun detaliu. Fii primul care publică unul."}
          </p>
          <Link
            href="/details/new"
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Adaugă un detaliu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map((d) => (
            <DetailCard key={d.id} detail={d} />
          ))}
        </div>
      )}
    </main>
  );
}
