"use client";

import { House } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "./brand-logo";

// Next.js App Router păstrează poziția de scroll la navigare dacă pagina țintă e deja „vizibilă"
// (userul e deja pe /feed, eventual filtrat) — clic pe logo/„Acasă" îl lăsa exact unde era, nu la
// începutul feed-ului (semnalat 2026-08-11). Forțăm scroll la 0 la click, indiferent de navigarea
// Next.js (care oricum duce corect la /feed, doar nu resetează poziția când pagina nu se remontează).
function scrollFeedToTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function BrandLogoHome({ size }: { size: number }) {
  return <BrandLogo href="/feed" size={size} onClick={scrollFeedToTop} />;
}

export function HomeIconLink() {
  return (
    <Link
      href="/feed"
      aria-label="Acasă"
      title="Acasă"
      onClick={scrollFeedToTop}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
    >
      <House className="size-5" strokeWidth={2} />
    </Link>
  );
}
