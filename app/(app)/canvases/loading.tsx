import { Skeleton } from "@/components/ui/skeleton";

// Schelet pentru „Planșele mele" — titlu + buton + grid de carduri.
export default function CanvasesLoading() {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <Skeleton className="mb-5 h-9 w-36 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
