import { Skeleton } from "@/components/ui/skeleton";

// Schelet pentru pagina unui detaliu — antet + imaginea 2D + panou validare, cu sidebar pe desktop.
export default function DetailLoading() {
  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-5">
      <Skeleton className="mb-5 h-4 w-64" />

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-7">
          {/* antet */}
          <div>
            <Skeleton className="h-9 w-3/4" />
            <div className="mt-4 flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          </div>
          {/* imaginea 2D */}
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          {/* panou validare */}
          <Skeleton className="h-32 w-full rounded-2xl" />
          {/* dezbatere */}
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        <aside className="hidden flex-col gap-4 lg:flex">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </aside>
      </div>
    </main>
  );
}
