import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSidebar } from "@/components/feed-sidebar";

import { FeedEmpty } from "@/app/feed/feed-empty";

import { MOCK_CATEGORIES_WITH_COUNTS, MOCK_FEED, MOCK_PROFILE } from "../mock";

// Preview feed cu date mock (fără DB/auth). DOAR non-producție. Același layout pe 3 coloane ca /feed.
export default async function DevFeedPreview({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const base = "/dev/preview/feed";
  const { cat } = await searchParams;
  const activeId = cat && MOCK_CATEGORIES_WITH_COUNTS.some((c) => c.id === cat) ? cat : null;
  const details = activeId ? MOCK_FEED.filter((d) => d.categoryId === activeId) : MOCK_FEED;

  const total = MOCK_CATEGORIES_WITH_COUNTS.reduce((sum, c) => sum + c.count, 0);
  const popular = [...MOCK_CATEGORIES_WITH_COUNTS].sort((a, b) => b.count - a.count).slice(0, 4);
  const debated = [...details]
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      title: d.title,
      commentCount: d.commentCount,
      sketchCount: d.sketchCount,
    }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6">
          <BrandLogo href="/dev/preview" />
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Preview · feed
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-6 px-6 pb-16 pt-7 lg:grid-cols-[248px_1fr] xl:grid-cols-[248px_1fr_280px]">
        <FeedSidebar
          profile={MOCK_PROFILE}
          categories={MOCK_CATEGORIES_WITH_COUNTS}
          activeId={activeId}
          basePath={base}
          addHref="#"
          total={total}
        />

        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Detalii recente</h1>
            <div className="font-mono text-xs text-muted-foreground">
              sortează: <span className="text-foreground">în dezbatere</span>
            </div>
          </div>

          {details.length === 0 ? (
            <FeedEmpty filtered={!!activeId} addHref="#" />
          ) : (
            <div className="flex flex-col gap-4">
              {details.map((d) => (
                <DetailCard key={d.id} detail={d} />
              ))}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Date fictive pentru preview.{" "}
            <Link href="/dev/preview/sketch" className="underline underline-offset-4">
              Vezi editorul de schiță →
            </Link>
          </p>
        </main>

        <FeedRail categories={popular} debated={debated} basePath={base} />
      </div>
    </div>
  );
}
