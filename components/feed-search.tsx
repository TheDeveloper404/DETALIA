"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 275;

// Pură, testabilă separat: (re)scrie parametrul `q` peste search params existente (păstrează `cat` etc.).
export function buildFeedSearchUrl(pathname: string, currentParams: URLSearchParams, q: string): string {
  const next = new URLSearchParams(currentParams);
  const trimmed = q.trim();
  if (trimmed) {
    next.set("q", trimmed);
  } else {
    next.delete("q");
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function FeedSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  // Ultimul `q` trimis chiar de NOI (debounce → router.replace), nu de o navigare externă. State, NU
  // ref — citirea unui ref în timpul render-ului e interzisă (regulă React, prinsă de lint). Necesar ca
  // să distingem cele două motive pentru care `initialQuery` se poate schimba (bug găsit 2026-08-07:
  // tastezi rapid „scrii, ștergi, scrii" — până se întoarce navigarea declanșată de PRIMUL cuvânt,
  // ecoul ei (props `initialQuery` reîmprospătat cu valoarea veche) suprascria orice tastasei între
  // timp). Dacă props-ul nou == ce am trimis noi ultima dată, e doar ecoul propriei navigări → ignorăm.
  const [lastPushed, setLastPushed] = useState(initialQuery);
  // Ajustare de state în timpul render-ului (pattern React recomandat), nu într-un efect —
  // resincronizează input-ul DOAR la o schimbare cu adevărat externă (buton Înapoi, schimbare categorie).
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery);
    if (initialQuery !== lastPushed) {
      setValue(initialQuery);
    }
  }

  useEffect(() => {
    if (value.trim() === initialQuery.trim()) return;
    const handle = setTimeout(() => {
      const trimmed = value.trim();
      setLastPushed(trimmed);
      router.replace(buildFeedSearchUrl(pathname, searchParams, value), { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-[460px]" role="search">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Caută detalii…"
        aria-label="Caută detalii"
        className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}
