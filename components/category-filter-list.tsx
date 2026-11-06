"use client";

// Lista de categorii din sidebar-ul feed-ului — aceeași structură ierarhică (secțiuni + capitole cu
// dropdown + frunze bifabile) ca formularul de creare detaliu (`detail-form.tsx` → `CategoryDropdown`),
// dar ca link-uri de filtru în loc de checkbox-uri. Capitolele (ex. „Instalații") NU sunt filtre reale
// (n-au `detail_categories` proprii) — doar antete expandabile pentru sub-categoriile lor.
import { ChevronDown, X } from "lucide-react";
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
  removeHref,
  compact = false,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  removeHref?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center rounded-lg transition-colors ${compact ? "text-[13.5px]" : "text-[14.5px]"} ${
        active
          ? "bg-primary/10 font-semibold text-foreground"
          : "text-foreground/80 hover:bg-secondary"
      }`}
    >
      <Link
        href={href}
        className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 no-underline ${compact ? "py-1.5" : "py-2.5"}`}
      >
        {label}
        {count > 0 && (
          <span className={`font-mono text-[11.5px] ${active ? "text-primary" : "text-muted-foreground"}`}>
            {count}
          </span>
        )}
      </Link>
      {removeHref && (
        <Link
          href={removeHref}
          scroll={false}
          aria-label={`Scoate filtrul ${label}`}
          className={`flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary ${compact ? "size-8" : "size-11"}`}
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      )}
    </div>
  );
}

// Capitol cu subcategorii (ex. Instalații → Electrice/Sanitare/Termice/HVAC) — pornește colapsat,
// se deschide la click pe antet (același pattern ca CategoryDropdown din formular).
function CategoryGroup({
  name,
  leaves,
  activeIds,
  catHref,
  compact,
}: {
  name: string;
  leaves: SidebarCategory[];
  activeIds: string[];
  catHref: (id?: string, remove?: boolean) => string;
  compact: boolean;
}) {
  const containsActive = leaves.some((c) => activeIds.includes(c.id));
  const [expanded, setExpanded] = useState(containsActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-foreground/80 hover:bg-secondary ${compact ? "py-1.5 text-[13.5px]" : "py-2.5 text-[14.5px]"}`}
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
              href={catHref(c.id)}
              label={c.name}
              count={c.count}
              active={activeIds.includes(c.id)}
              removeHref={activeIds.includes(c.id) ? catHref(c.id, true) : undefined}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryFilterList({
  categories,
  activeIds,
  basePath,
  total,
  q = null,
  unanswered = false,
  filterQuery = "",
  sidebar = false,
}: {
  categories: SidebarCategory[];
  activeIds: string[];
  basePath: string;
  total: number;
  // Filtrele active din feed (căutare + „fără răspuns") — păstrate la click pe categorie, altfel
  // selectarea unei categorii resetează silențios restul (Greptile PR #272).
  q?: string | null;
  unanswered?: boolean;
  filterQuery?: string;
  // Coloana de desktop: sectiuni inchise, una singura deschisa (cea cu ultima categorie aleasa),
  // randuri compacte, ca lista sa incapa in ecran fara scroll intern. Sheet-ul de pe mobil ramane cum era.
  sidebar?: boolean;
}) {
  const sections = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const sectionHas = (sectionId: string, ids: string[]) =>
    childrenOf(sectionId).some(
      (c) => ids.includes(c.id) || (c.isGroup && childrenOf(c.id).some((leaf) => ids.includes(leaf.id))),
    );
  const sectionHasActive = (sectionId: string) => sectionHas(sectionId, activeIds);
  // Ultimul id din URL e ultima categorie aleasa (catHref adauga la coada).
  const [openSection, setOpenSection] = useState<string | null>(
    () => sections.find((s) => sectionHas(s.id, activeIds.slice(-1)))?.id ?? null,
  );

  const catHref = (id?: string, remove = false) => {
    const p = new URLSearchParams(filterQuery);
    if (id) {
      const nextIds = remove
        ? activeIds.filter((activeId) => activeId !== id)
        : [...new Set([...activeIds, id])];
      if (nextIds.length) p.set("cat", nextIds.join(","));
    }
    if (q) p.set("q", q);
    if (unanswered) p.set("unanswered", "1");
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const sectionItems = (sectionId: string) =>
    childrenOf(sectionId).map((leaf) =>
      leaf.isGroup ? (
        <CategoryGroup
          key={leaf.id}
          name={leaf.name}
          leaves={childrenOf(leaf.id)}
          activeIds={activeIds}
          catHref={catHref}
          compact={sidebar}
        />
      ) : (
        <CategoryLink
          key={leaf.id}
          href={catHref(leaf.id)}
          label={leaf.name}
          count={leaf.count}
          active={activeIds.includes(leaf.id)}
          removeHref={activeIds.includes(leaf.id) ? catHref(leaf.id, true) : undefined}
          compact={sidebar}
        />
      ),
    );

  return (
    <>
      <CategoryLink
        href={catHref()}
        label="Toate detaliile"
        count={total}
        active={activeIds.length === 0}
        compact={sidebar}
      />
      {sections.map((section) =>
        sidebar ? (
          <div key={section.id} className="mt-1">
            <button
              type="button"
              onClick={() => setOpenSection((current) => (current === section.id ? null : section.id))}
              aria-expanded={openSection === section.id}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold text-foreground hover:bg-secondary"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {section.name}
                {openSection !== section.id && sectionHasActive(section.id) && (
                  <>
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="sr-only">(filtru activ)</span>
                  </>
                )}
              </span>
              <ChevronDown
                className={`size-3.5 flex-none text-muted-foreground transition-transform ${openSection === section.id ? "rotate-180" : ""}`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
            {openSection === section.id && (
              <div className="ml-3 flex flex-col border-l border-border pl-2">{sectionItems(section.id)}</div>
            )}
          </div>
        ) : (
          <div key={section.id} className="mt-2 first:mt-0">
            <div className="px-3 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/70">
              {section.name}
            </div>
            <div className="flex flex-col">{sectionItems(section.id)}</div>
          </div>
        ),
      )}
    </>
  );
}
