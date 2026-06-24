import { Skeleton } from "@/components/ui/skeleton";

// Schelet pentru feed — oglindește grila pe 3 coloane (sidebar · listă carduri · rail) ca tranziția
// spre conținutul real să nu „salte".
export default function FeedLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 items-start gap-6 px-6 pb-16 pt-7 lg:grid-cols-[248px_1fr] xl:grid-cols-[248px_1fr_280px]">
      {/* sidebar */}
      <div className="hidden flex-col gap-4 lg:flex">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>

      {/* listă */}
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>

      {/* rail */}
      <div className="hidden flex-col gap-4 xl:flex">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}
