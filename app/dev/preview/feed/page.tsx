import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { CategoryFilter } from "@/components/category-filter";
import { DetailCard } from "@/components/detail-card";
import { Button } from "@/components/ui/button";

import { MOCK_CATEGORIES, MOCK_FEED } from "../mock";

// Preview feed cu date mock (fără DB/auth). DOAR non-producție.
export default async function DevFeedPreview({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { cat } = await searchParams;
  const activeId = cat && MOCK_CATEGORIES.some((c) => c.id === cat) ? cat : null;
  const details = activeId ? MOCK_FEED.filter((d) => d.categoryId === activeId) : MOCK_FEED;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6">
          <BrandLogo href="/dev/preview" />
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preview · feed
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Detalii</h1>
            <p className="text-sm text-muted-foreground">
              Detalii de execuție din comunitate. Aprobă, dezaprobă sau propune o schiță.
            </p>
          </div>
          <Button className="h-10 px-4" disabled>
            Adaugă detaliu
          </Button>
        </header>

        <CategoryFilter categories={MOCK_CATEGORIES} activeId={activeId} basePath="/dev/preview/feed" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map((d) => (
            <DetailCard key={d.id} detail={d} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Date fictive pentru preview.{" "}
          <Link href="/dev/preview/sketch" className="underline underline-offset-4">
            Vezi editorul de schiță →
          </Link>
        </p>
      </main>
    </div>
  );
}
