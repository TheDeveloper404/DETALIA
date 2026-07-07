"use client";

// Lista de categorii din sidebar-ul feed-ului — aceeași structură ierarhică (secțiuni + capitole cu
// dropdown + frunze bifabile) ca formularul de creare detaliu (`detail-form.tsx` → `CategoryDropdown`),
// dar ca link-uri de filtru în loc de checkbox-uri. Capitolele (ex. „Instalații") NU sunt filtre reale
// (n-au `detail_categories` proprii) — doar antete expandabile pentru sub-categoriile lor.
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type SidebarCategory = {
  id: string;
  parentId: string | null;
  name: string;
  isGroup: boolean;
  count: number;
};

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
      className={`flex items-center justify-between rounded-lg border-l-2 px-3 py-2.5 text-[14.5px] no-underline transition-colors ${
        active
          ? "border-primary font-semibold text-foreground"
          : "border-transparent text-foreground/80 hover:bg-secondary"
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`font-mono text-[11.5px] ${active ? "text-primary" : "text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </Link>
  );
}

// Capitol cu subcategorii (ex. Instalații → Electrice/Sanitare/Termice/HVAC) — pornește colapsat,
// se deschide la click pe antet (același pattern ca CategoryDropdown din formular).
function CategoryGroup({
  name,
  leaves,
  basePath,
  activeId,
}: {
  name: string;
  leaves: SidebarCategory[];
  basePath: string;
  activeId: string | null;
}) {
  const containsActive = leaves.some((c) => c.id === activeId);
  const [expanded, setExpanded] = useState(containsActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14.5px] font-medium text-foreground/80 hover:bg-secondary"
      >
        <ChevronDown
          className={`size-3.5 flex-none text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
        {name}
      </button>
      {expanded && (
        <div className="ml-3 flex flex-col border-l border-border pl-2">
          {leaves.map((c) => (
            <CategoryLink
              key={c.id}
              href={`${basePath}?cat=${c.id}`}
              label={c.name}
              count={c.count}
              active={activeId === c.id}
            />
          ))}
        </div>
      )}
    </div>
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
  const sections = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <>
      <CategoryLink href={basePath} label="Toate detaliile" count={total} active={!activeId} />
      {sections.map((section) => (
        <div key={section.id} className="mt-2 first:mt-0">
          <div className="px-3 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/70">
            {section.name}
          </div>
          <div className="flex flex-col">
            {childrenOf(section.id).map((leaf) =>
              leaf.isGroup ? (
                <CategoryGroup
                  key={leaf.id}
                  name={leaf.name}
                  leaves={childrenOf(leaf.id)}
                  basePath={basePath}
                  activeId={activeId}
                />
              ) : (
                <CategoryLink
                  key={leaf.id}
                  href={`${basePath}?cat=${leaf.id}`}
                  label={leaf.name}
                  count={leaf.count}
                  active={activeId === leaf.id}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}
