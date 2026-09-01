import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { feedPageWindow } from "@/server/domain/detail";

// Paginare stil forum (decizie 2026-08-16) — Anterior/Următor + numere, păstrează filtrele active
// (?cat=/?q=). Server Component pur (Link-uri, fără JS de client) — navigarea o face Next.js normal.
export function FeedPagination({
  page,
  totalPages,
  categoryId,
  q,
  unanswered = false,
}: {
  page: number;
  totalPages: number;
  categoryId: string | null;
  q: string | null;
  unanswered?: boolean;
}) {
  if (totalPages <= 1) return null;

  function href(target: number) {
    const params = new URLSearchParams();
    if (categoryId) params.set("cat", categoryId);
    if (q) params.set("q", q);
    if (unanswered) params.set("unanswered", "1");
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/feed?${qs}` : "/feed";
  }

  const windowed = feedPageWindow(page, totalPages);

  return (
    <nav
      aria-label="Paginare feed"
      className="mt-6 flex items-center justify-center gap-1.5 font-mono text-[13px]"
    >
      <PageLink
        href={href(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Pagina anterioară"
      >
        <ChevronLeft className="size-3.5" strokeWidth={2} />
      </PageLink>

      {windowed.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <PageLink key={p} href={href(p)} active={p === page} aria-label={`Pagina ${p}`}>
            {p}
          </PageLink>
        ),
      )}

      <PageLink
        href={href(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Pagina următoare"
      >
        <ChevronRight className="size-3.5" strokeWidth={2} />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label": string;
}) {
  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground/40"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border no-underline transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-[#e6ddcf] bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
