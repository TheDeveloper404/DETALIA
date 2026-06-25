import { Skeleton } from "@/components/ui/skeleton";

// Schelet pentru profil — cover + avatar suprapus, bară de stats, apoi conținutul pe taburi.
export default function ProfileLoading() {
  return (
    <main className="flex-1 pt-2">
      <div className="mx-auto w-full max-w-[1080px] px-6 pb-16">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="-mt-10 flex items-end gap-4 px-2">
          <Skeleton className="size-24 rounded-full ring-4 ring-background" />
          <div className="flex flex-col gap-2 pb-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 flex-1 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-8 h-48 w-full rounded-xl" />
      </div>
    </main>
  );
}
