"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Fade-in fin la ATERIZAREA în feed dintr-un magic link (callbackUrl `/feed?welcome=1`).
// Doar atunci; navigările normale (filtre, sortare, retur) randează instant, fără animație.
export function FeedEntrance({
  welcome,
  children,
}: {
  welcome: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Fără welcome → deja „intrat" (vizibil instant). Cu welcome → pornim ascuns și fadeuim.
  const [entered, setEntered] = useState(!welcome);

  useEffect(() => {
    if (!welcome) return;
    const id = requestAnimationFrame(() => setEntered(true));
    // Curăță ?welcome=1 din URL fără reload → refresh/înapoi nu re-declanșează animația.
    router.replace(pathname, { scroll: false });
    return () => cancelAnimationFrame(id);
  }, [welcome, pathname, router]);

  return (
    <div
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(8px)",
        transition: "opacity 700ms cubic-bezier(0.4, 0, 0.2, 1), transform 700ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}
