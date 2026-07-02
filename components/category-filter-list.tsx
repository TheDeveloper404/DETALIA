"use client";

// Lista de categorii din sidebar-ul feed-ului — trunchiată la primele CAP_COLLAPSED, cu „Vezi mai multe"
// dacă sunt mai multe (evită un sidebar interminabil când taxonomia are 20+ categorii bifabile).
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type SidebarCategory = { id: string; name: string; count: number };

const CAP_COLLAPSED = 6;

function CategoryLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[14.5px] no-underline transition-colors ${
        active
          ? "bg-secondary font-semibold text-foreground"
          : "text-foreground/80 hover:bg-secondary"
      }`}
    >
      {label}
      <span className={`font-mono text-[11.5px] ${active ? "text-primary" : "text-muted-foreground"}`}>
        {count}
      </span>
    </Link>
  );
}

export function CategoryFilterList({
  categories,
  activeId,
  basePath,
  total,
}: {
  categories: SidebarCategory[];
  activeId: string | null;
  basePath: string;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? categories : categories.slice(0, CAP_COLLAPSED);
  const hasMore = categories.length > CAP_COLLAPSED;

  return (
    <>
      <CategoryLink href={basePath} label="Toate detaliile" count={total} active={!activeId} />
      {visible.map((c) => (
        <CategoryLink
          key={c.id}
          href={`${basePath}?cat=${c.id}`}
          label={c.name}
          count={c.count}
          active={activeId === c.id}
        />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-primary hover:bg-secondary/60"
        >
          {expanded ? (
            <>
              Arată mai puține <ChevronUp className="size-3.5" strokeWidth={2} />
            </>
          ) : (
            <>
              Vezi mai multe ({categories.length - CAP_COLLAPSED}) <ChevronDown className="size-3.5" strokeWidth={2} />
            </>
          )}
        </button>
      )}
    </>
  );
}
