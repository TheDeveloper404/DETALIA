import { Skeleton } from "@/components/ui/skeleton";

// Fallback generic de încărcare (Suspense la nivel de root) — afișat pe rutele fără un `loading.tsx`
// dedicat cât timp Server Component-ul așteaptă datele. Rutele „grele" (feed/detaliu/profil) au schelet propriu.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-7">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  );
}
