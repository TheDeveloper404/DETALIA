import { cn } from "@/lib/utils";

// Primitivă de loading — bloc cu puls discret. Folosită în fișierele `loading.tsx` (fallback-uri Suspense)
// ca paginile cu query-uri DB să nu „sară” gol → schelet pe forma conținutului real.
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
