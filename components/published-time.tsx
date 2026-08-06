"use client";

import { useSyncExternalStore } from "react";

import { formatPublishedRelative } from "@/lib/format";

// Insulă client pentru data de publicare din feed.
//
// DE CE client: feed-ul e Server Component — un text relativ randat acolo („acum 3 minute") rămâne
// înghețat la momentul generării paginii cât timp userul stă pe ea (și cu atât mai mult dacă pagina e
// cache-uită). Componenta primește timestamp-ul BRUT ca prop și recalculează textul la hidratare +
// din minut în minut; restul feed-ului rămâne Server Component.
//
// `useSyncExternalStore` (nu useEffect + setState): sursa de adevăr e ceasul, un sistem EXTERN lui
// React. Snapshot-ul e minutul curent — se schimbă o dată pe minut, deci re-randează exact atunci,
// iar la hidratare clientul citește imediat valoarea reală (nu așteaptă primul tick).
function subscribeToMinuteTick(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function currentMinute() {
  return Math.floor(Date.now() / 60_000);
}

export function PublishedTime({ value, className }: { value: string | Date; className?: string }) {
  const iso = typeof value === "string" ? value : value.toISOString();
  useSyncExternalStore(subscribeToMinuteTick, currentMinute, currentMinute);

  // suppressHydrationWarning: textul e f(Date.now()) — serverul îl calculează la un moment, clientul la
  // altul, deci markup-ul poate diferi legitim la hidratare (același pattern ca la comentarii/notificări).
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatPublishedRelative(iso)}
    </time>
  );
}
